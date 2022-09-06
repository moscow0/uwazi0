/* eslint-disable max-lines */
/* eslint-disable max-statements */

import { createError } from 'api/utils';
import SHA256 from 'crypto-js/sha256';
import crypto from 'crypto';
import { catchErrors } from 'api/utils/jasmineHelpers';
import mailer from 'api/utils/mailer';
import db from 'api/utils/testing_db';
import * as random from 'shared/uniqueID';

import encryptPassword, { comparePasswords } from 'api/auth/encryptPassword';
import * as usersUtils from 'api/auth2fa/usersUtils';
import { settingsModel } from 'api/settings/settingsModel';
import userGroups from 'api/usergroups/userGroups';
import fixtures, {
  userId,
  expectedKey,
  recoveryUserId,
  group1Id,
  group2Id,
  userToDelete,
} from './fixtures.js';
import users from '../users.js';
import passwordRecoveriesModel from '../passwordRecoveriesModel';
import usersModel from '../usersModel';

describe('Users', () => {
  beforeEach(done => {
    db.clearAllAndLoad(fixtures).then(done).catch(catchErrors(done));
  });

  afterAll(done => {
    db.disconnect().then(done);
  });

  describe('save', () => {
    let currentUser = { _id: userId };

    it('should save user matching id', done =>
      users
        .save({ _id: userId.toString(), password: 'new_password' }, currentUser)
        .then(() => users.get({ _id: userId }, '+password'))
        .then(async ([user]) => {
          expect(await comparePasswords('new_password', user.password)).toBe(true);
          expect(user.username).toBe('username');
          done();
        })
        .catch(catchErrors(done)));

    it('should not save a null password on update', async () => {
      const user = { _id: recoveryUserId, role: 'admin' };

      const [userInDb] = await users.get(recoveryUserId, '+password');
      await users.save(user, { _id: userId, role: 'admin' });
      const [updatedUser] = await users.get(recoveryUserId, '+password');

      expect(updatedUser.password.toString()).toBe(userInDb.password.toString());
    });

    it('should not change the "using2fa" or "secret" properties through this method', async () => {
      const user = { _id: recoveryUserId, using2fa: true, secret: 'UNAUTHORIZED ENTRY POINT' };
      await users.save(user, { _id: userId, role: 'admin' });
      const [updatedUser] = await usersModel.get({ _id: recoveryUserId }, '+secret');
      expect(updatedUser.using2fa).toBe(false);
      expect(updatedUser.secret).toBeUndefined();
    });

    const assertUserMembership = async updatedUser => {
      const groups = await userGroups.get();
      const membership1 = groups[0].members.find(
        m => m.refId.toString() === updatedUser._id.toString()
      );
      const membership2 = groups[1].members.find(
        m => m.refId.toString() === updatedUser._id.toString()
      );
      expect(membership1).not.toBeUndefined();
      expect(membership2).not.toBeUndefined();
    };
    it('should update the membership of the saved user', async () => {
      currentUser = { _id: 'user2', role: 'admin' };
      const userToUpdate = {
        _id: userId.toString(),
        groups: [{ _id: group1Id.toString() }, { _id: group2Id.toString() }],
      };
      const updatedUser = await users.save(userToUpdate, currentUser);
      await assertUserMembership(updatedUser);
    });
    it('should remove all groups if user has not any', async () => {
      currentUser = { _id: 'user2', role: 'admin' };
      const userToUpdate = {
        _id: userId.toString(),
        groups: [],
      };
      const updatedUser = await users.save(userToUpdate, currentUser);
      const groups = await userGroups.get({ 'members._id': updatedUser._id.toString() });
      expect(groups.length).toBe(0);
    });

    it.each(['collaborator', 'editor'])(
      'should throw an unauthorized error if a %s user tries to update another user',
      async role => {
        try {
          currentUser = { _id: 'user3', role };
          const userToUpdate = {
            _id: userId,
            username: 'otherName',
          };
          await users.save(userToUpdate, currentUser);
          fail('Should throw error');
        } catch (e) {
          expect(e.code).toBe(403);
          expect(e.message).toEqual('Unauthorized');
        }
      }
    );

    describe('when you try to change role', () => {
      it('should be an admin', done => {
        currentUser = { _id: userId, role: 'editor' };
        const user = { _id: recoveryUserId, role: 'admin' };
        return users
          .save(user, currentUser)
          .then(() => {
            done.fail('should throw an error');
          })
          .catch(error => {
            expect(error).toEqual(createError('Unauthorized', 403));
            done();
          })
          .catch(catchErrors(done));
      });

      it('should not modify yourself', done => {
        currentUser = { _id: userId, role: 'admin' };
        const user = { _id: userId.toString(), role: 'editor' };
        return users
          .save(user, currentUser)
          .then(() => {
            done.fail('should throw an error');
          })
          .catch(error => {
            expect(error).toEqual(createError('Can not change your own role', 403));
            done();
          })
          .catch(catchErrors(done));
      });
    });

    describe('newUser', () => {
      const domain = 'http://localhost';

      beforeEach(() => {
        spyOn(users, 'recoverPassword').and.callFake(async () => Promise.resolve());
        jest.spyOn(random, 'default').mockReturnValue('mypass');
      });

      it('should do the recover password process (as a new user)', done => {
        users
          .newUser(
            {
              username: 'spidey',
              email: 'peter@parker.com',
              password: 'mypass',
              role: 'editor',
            },
            domain
          )
          .then(() => users.get({ username: 'spidey' }))
          .then(([user]) => {
            expect(user.username).toBe('spidey');
            expect(users.recoverPassword).toHaveBeenCalledWith('peter@parker.com', domain, {
              newUser: true,
            });
            done();
          })
          .catch(catchErrors(done));
      });

      it('should create a random password when none is provided', async () => {
        await users.newUser(
          {
            username: 'someone',
            email: 'someone@mailer.com',
            role: 'admin',
          },
          domain
        );

        expect(random.default).toHaveBeenCalled();
        const [user] = await users.get({ username: 'someone' }, '+password');
        expect(await comparePasswords('mypass', user.password)).toBe(true);
      });

      it('should not allow repeat username', done => {
        users
          .newUser(
            { username: 'username', email: 'peter@parker.com', role: 'editor' },
            currentUser,
            domain
          )
          .then(() => {
            done.fail('should throw an error');
          })
          .catch(error => {
            expect(error).toEqual(createError('Username already exists', 409));
            done();
          });
      });

      it('should not allow repeat email', done => {
        users
          .newUser(
            { username: 'spidey', email: 'test@email.com', role: 'editor' },
            currentUser,
            domain
          )
          .then(() => {
            done.fail('should throw an error');
          })
          .catch(error => {
            expect(error).toEqual(createError('Email already exists', 409));
            done();
          });
      });

      it('should not allow sending two-step verification data on creation', async () => {
        await users.newUser(
          {
            username: 'without2fa',
            email: 'another@email.com',
            password: 'mypass',
            role: 'editor',
            using2fa: true,
            secret: 'UNAUTHORIZED SECRET',
          },
          currentUser,
          domain
        );

        const [createdUser] = await usersModel.get({ username: 'without2fa' }, '+secret');
        expect(createdUser.using2fa).toBe(false);
        expect(createdUser.secret).toBeUndefined();
      });

      it('should add the new user to the specified userGroups', async () => {
        const createdUser = await users.newUser(
          {
            username: 'spidey',
            email: 'peter@parker.com',
            password: 'mypass',
            role: 'editor',
            groups: [{ _id: group1Id.toString() }, { _id: group2Id.toString() }],
          },
          domain
        );

        await assertUserMembership(createdUser);
      });
    });
  });

  describe('login', () => {
    let testUser;
    const codeBuffer = Buffer.from('code');

    beforeEach(async () => {
      testUser = {
        username: 'someuser1',
        password: await encryptPassword('password'),
        email: 'someuser1@mailer.com',
        role: 'admin',
      };
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(codeBuffer);
      jest.spyOn(mailer, 'send').mockResolvedValue();
    });

    afterEach(() => {
      crypto.randomBytes.mockRestore();
      mailer.send.mockRestore();
    });

    const testLogin = async (username, password, token) =>
      users.login({ username, password, token }, 'http://host.domain');

    const createUserAndTestLogin = async (username, password, token) => {
      await usersModel.save(testUser);
      return testLogin(username, password, token);
    };

    const assessFailedLogins = async (operator, value) => {
      const [dbUser] = await usersModel.get({ username: 'someuser1' }, '+failedLogins');
      if (!value) {
        expect(dbUser.failedLogins)[operator]();
      }
      expect(dbUser.failedLogins)[operator](value);
    };

    it('should return user with matching username and password', async () => {
      const user = await createUserAndTestLogin('someuser1', 'password');
      delete user._id;
      expect(user).toMatchSnapshot();
    });

    it('should reset failedLogins counter when login is successful', async () => {
      testUser.failedLogins = 5;
      await createUserAndTestLogin('someuser1', 'password');
      await assessFailedLogins('toBeFalsy');
    });

    it('should throw error if username does not exist', async () => {
      try {
        await createUserAndTestLogin('unknownuser1', 'password');
        fail('should throw error');
      } catch (e) {
        expect(e).toEqual(createError('Invalid username or password', 401));
      }
    });

    it('should throw error if password is incorrect and increment failedLogins', async () => {
      try {
        await createUserAndTestLogin('someuser1', 'incorrect');
        fail('should throw error');
      } catch (e) {
        await assessFailedLogins('toBe', 1);
      }
      try {
        await testLogin('someuser1', 'incorrect again');
        fail('should throw error');
      } catch (e) {
        await assessFailedLogins('toBe', 2);
      }
    });

    it('should lock account after sixth failed login attempt and generate unlock code', async () => {
      testUser.failedLogins = 5;
      try {
        await createUserAndTestLogin('someuser1', 'incorrect');
        fail('should throw error');
      } catch (e) {
        expect(e).toEqual(createError('Account locked. Check your email to unlock.', 403));
        const [user] = await users.get(
          { username: 'someuser1' },
          '+accountLocked +accountUnlockCode'
        );
        expect(user.accountLocked).toBe(true);
        expect(user.accountUnlockCode).toBe(codeBuffer.toString('hex'));
        expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      }
    });

    it('after locking account, it should send user and email with the unlock link', async () => {
      testUser.failedLogins = 5;
      try {
        await createUserAndTestLogin('someuser1', 'incorrect');
        fail('should throw error');
      } catch (e) {
        expect(mailer.send.mock.calls[0]).toMatchSnapshot();
      }
    });

    it('should prevent login if account is locked when credentials are correct', async () => {
      testUser.accountLocked = true;
      try {
        await createUserAndTestLogin('someuser1', 'password');
        fail('should throw error');
      } catch (e) {
        expect(e.message).toMatch(/account locked/i);
        expect(e.code).toBe(403);
      }
    });

    it('should prevent login if account is locked when credentials are not correct', async () => {
      testUser.accountLocked = true;
      try {
        await createUserAndTestLogin('someuser1', 'incorrect');
        fail('should throw error');
      } catch (e) {
        expect(e.message).toMatch(/account locked/i);
        expect(e.code).toBe(403);
      }
    });

    describe('2fa', () => {
      beforeEach(() => {
        testUser.using2fa = true;
        testUser.failedLogins = 4;

        spyOn(usersUtils, 'verifyToken').and.callFake((_user, token) => {
          if (token === 'correctToken') {
            return Promise.resolve({ validToken: true });
          }

          return Promise.reject(createError('two-factor-failed', 401));
        });
      });

      it('should login if account requires 2fa and correct token sent', async () => {
        const user = await createUserAndTestLogin('someuser1', 'password', 'correctToken');
        delete user._id;
        expect(user).toMatchSnapshot();
        await assessFailedLogins('toBeFalsy');
      });

      it('should prevent login if account requires 2fa and no token found, not affecting failed logins', async () => {
        try {
          await createUserAndTestLogin('someuser1', 'password');
          fail('should throw error');
        } catch (e) {
          expect(e.message).toMatch(/two-step verification token required/i);
          expect(e.code).toBe(409);
          await assessFailedLogins('toBe', 4);
        }
      });

      it('should not login if account requires 2fa and incorrect token sent, incrementing the failed logins', async () => {
        try {
          await createUserAndTestLogin('someuser1', 'password', 'incorrectToken');
          fail('Should throw error');
        } catch (e) {
          expect(e.message).toBe('two-factor-failed');
          await assessFailedLogins('toBe', 5);
        }
      });
    });
  });

  describe('unlockAccount', () => {
    let testUser;
    beforeEach(async () => {
      testUser = {
        username: 'someuser1',
        password: await encryptPassword('password'),
        email: 'someuser1@mailer.com',
        role: 'admin',
        accountLocked: true,
        accountUnlockCode: 'code',
        failedLogins: 3,
      };
    });
    const testUnlock = async (username, code) => users.unlockAccount({ username, code });
    const createUserAndTestUnlock = async (username, code) => {
      await usersModel.save(testUser);
      return testUnlock(username, code);
    };
    it('should unlock account if username and code are correct', async () => {
      await createUserAndTestUnlock('someuser1', 'code');
      const [user] = await users.get(
        { username: 'someuser1' },
        '+accountLocked +accountUnlockCode +failedLogins'
      );
      expect(user.accountLocked).toBeFalsy();
      expect(user.accountLockCode).toBeFalsy();
      expect(user.failedLogins).toBeFalsy();
    });
    it('should throw error if username is incorrect', async () => {
      try {
        await createUserAndTestUnlock('unknownuser1', 'code');
        fail('should throw error');
      } catch (e) {
        expect(e).toEqual(createError('Invalid username or unlock code', 403));
        const [user] = await users.get(
          { username: 'someuser1' },
          '+accountLocked +accountUnlockCode +failedLogins'
        );
        expect(user.accountLocked).toBe(true);
        expect(user.accountUnlockCode).toBe('code');
      }
    });
    it('should throw error if code is incorrect', async () => {
      try {
        await createUserAndTestUnlock('someruser1', 'incorrect');
        fail('should throw error');
      } catch (e) {
        expect(e).toEqual(createError('Invalid username or unlock code', 403));
        const [user] = await users.get(
          { username: 'someuser1' },
          '+accountLocked +accountUnlockCode +failedLogins'
        );
        expect(user.accountLocked).toBe(true);
        expect(user.accountUnlockCode).toBe('code');
      }
    });
  });

  describe('recoverPassword', () => {
    it('should find the matching email create a recover password doc in the database and send an email', async done => {
      spyOn(mailer, 'send').and.callFake(async () => Promise.resolve('OK'));
      spyOn(Date, 'now').and.returnValue(1000);
      const key = SHA256(`test@email.com${1000}`).toString();
      const settings = await settingsModel.get();
      users
        .recoverPassword('test@email.com', 'domain')
        .then(response => {
          expect(response).toBe('OK');
          return passwordRecoveriesModel.get({ key });
        })
        .then(recoverPasswordDb => {
          expect(recoverPasswordDb[0].user.toString()).toBe(userId.toString());
          const emailSender = mailer.createSenderDetails(settings[0]);
          const expectedMailOptions = {
            from: emailSender,
            to: 'test@email.com',
            subject: 'Password set',
            text: `To set your password click on the following link:\ndomain/setpassword/${key}`,
          };
          expect(mailer.send).toHaveBeenCalledWith(expectedMailOptions);
          done();
        })
        .catch(catchErrors(done));
    });

    it('should personalize the mail if recover password process is part of a newly created user', async done => {
      spyOn(mailer, 'send').and.callFake(async () => Promise.resolve('OK'));
      spyOn(Date, 'now').and.returnValue(1000);

      const key = SHA256(`peter@parker.com${1000}`).toString();
      const settings = await settingsModel.get();
      let newUserId;

      users
        .newUser(
          { username: 'spidey', email: 'peter@parker.com', password: 'mypass', role: 'editor' },
          'http://localhost'
        )
        .then(newUser => {
          newUserId = newUser._id.toString();
          return users.recoverPassword('peter@parker.com', 'http://localhost', { newUser: true });
        })
        .then(response => {
          expect(response).toBe('OK');
          return passwordRecoveriesModel.get({ key });
        })
        .then(recoverPasswordDb => {
          expect(recoverPasswordDb[0].user.toString()).toBe(newUserId);
          const emailSender = mailer.createSenderDetails(settings[0]);
          const expectedMailOptions = {
            from: emailSender,
            to: 'peter@parker.com',
            subject: 'Welcome to Uwazi instance',
            text: `To set your password click on the following link:\ndomain/setpassword/${key}`,
          };
          expect(mailer.send.calls.mostRecent().args[0].from).toBe(expectedMailOptions.from);
          expect(mailer.send.calls.mostRecent().args[0].to).toBe(expectedMailOptions.to);
          expect(mailer.send.calls.mostRecent().args[0].subject).toBe(expectedMailOptions.subject);

          expect(mailer.send.calls.mostRecent().args[0].text).toContain('administrators');
          expect(mailer.send.calls.mostRecent().args[0].text).toContain('Uwazi instance');
          expect(mailer.send.calls.mostRecent().args[0].text).toContain('spidey');
          expect(mailer.send.calls.mostRecent().args[0].text).toContain(
            `http://localhost/setpassword/${key}?createAccount=true`
          );

          expect(mailer.send.calls.mostRecent().args[0].html).toContain('administrators');
          expect(mailer.send.calls.mostRecent().args[0].html).toContain('Uwazi instance');
          expect(mailer.send.calls.mostRecent().args[0].html).toContain('<b>spidey</b></p>');
          expect(mailer.send.calls.mostRecent().args[0].html).toContain(
            '<a href="https://www.uwazi.io">https://www.uwazi.io</a>'
          );

          expect(mailer.send.calls.mostRecent().args[0].html).toContain(
            `<a href="http://localhost/setpassword/${key}?createAccount=true">http://localhost/setpassword/${key}?createAccount=true</a>`
          );
          done();
        })
        .catch(catchErrors(done));
    });

    describe('when something fails with the mailer', () => {
      it('should reject the promise and return the error', done => {
        spyOn(mailer, 'send').and.callFake(() => Promise.reject(new Error('some error')));

        users
          .recoverPassword('test@email.com')
          .then(() => {
            done.fail('should not have resolved');
          })
          .catch(error => {
            expect(error.message).toBe('some error');
            done();
          });
      });
    });

    describe('when the user does not exist with that email', () => {
      it('should not create the entry in the database, should not send a mail, and return an error.', done => {
        spyOn(Date, 'now').and.returnValue(1000);
        const key = SHA256(`false@email.com${1000}`).toString();
        users
          .recoverPassword('false@email.com')
          .catch(error => {
            expect(error.code).toBe(403);
            return passwordRecoveriesModel.get({ key });
          })
          .then(response => {
            expect(response.length).toBe(0);
            done();
          })
          .catch(catchErrors(done));
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset the password for the user based on the provided key', done => {
      users
        .resetPassword({ key: expectedKey, password: '1234' })
        .then(() => users.get({ _id: recoveryUserId }, '+password'))
        .then(async ([user]) => {
          expect(await comparePasswords('1234', user.password)).toBe(true);
          done();
        })
        .catch(catchErrors(done));
    });

    it('should delete the resetPassword', done => {
      passwordRecoveriesModel
        .get({ key: expectedKey })
        .then(response => {
          expect(response.length).toBe(1);
          return users.resetPassword({ key: expectedKey, password: '1234' });
        })
        .then(() => passwordRecoveriesModel.get({ key: expectedKey }))
        .then(response => {
          expect(response.length).toBe(0);
          done();
        })
        .catch(catchErrors(done));
    });
  });

  describe('delete()', () => {
    it('should delete the user', done => {
      users
        .delete(userId, { _id: 'another_user' })
        .then(() => users.getById(userId))
        .then(user => {
          expect(user).toBe(null);
          done();
        });
    });

    it('should not allow to delete self', done => {
      users
        .delete(userId.toString(), { _id: userId })
        .then(() => {
          done.fail('should throw an error');
        })
        .catch(error => {
          expect(error).toEqual(createError('Can not delete yourself', 403));
          return users.getById(userId);
        })
        .then(user => {
          expect(user).not.toBe(null);
          done();
        });
    });

    it('should not allow to delete the last user', async done => {
      await users.delete(userToDelete.toString(), { _id: 'someone' });
      await users.delete(recoveryUserId.toString(), { _id: 'someone' });
      try {
        await users.delete(userId.toString(), { _id: 'someone' });
        done.fail('should throw an error');
      } catch (error) {
        expect(error).toEqual(createError('Can not delete last user', 403));
        const user = await users.getById(userId);
        expect(user).toEqual({
          _id: userId,
          email: 'test@email.com',
          role: 'admin',
          username: 'username',
        });
        done();
      }
    });

    it('should delete the user in all the groups', async () => {
      await users.delete(userToDelete.toString(), { _id: 'someone' });
      const group = await userGroups.get({ name: 'Group 3' });
      expect(group[0].members.length).toBe(0);
    });
  });

  describe('getById', () => {
    it('should return the asked user without password or groups', async () => {
      const user = await users.getById(userId);
      expect(user.username).toBe('username');
      expect(user.password).toBe(undefined);
      expect(user.groups).toBe(undefined);
    });
    it('should return the asked user with groups if asked for', async () => {
      const user = await users.getById(userId, '-password', true);
      expect(user.username).toBe('username');
      expect(user.groups[0].name).toBe('Group 2');
    });

    it('should not fail if asking for groups but user does not exist', async () => {
      const user = await users.getById(db.id(), '-password', true);
      expect(user).toBe(null);
    });
  });

  describe('get', () => {
    it('should return all users without group data', async () => {
      const userList = await users.get();
      expect(userList.length).toBe(3);
      const groupData = userList.filter(u => u.groups !== undefined);
      expect(groupData.length).toBe(0);
    });

    it('should return all users with groups to which they belong', async () => {
      const userList = await users.get({}, '+groups');
      expect(userList.length).toBe(3);
      expect(userList[0].groups[0].name).toBe('Group 2');
      expect(userList[1].groups[0].name).toBe('Group 1');
    });
  });
});
