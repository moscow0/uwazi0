import React from 'react';
import { Icon } from 'UI';
import { Translate } from 'app/I18N';
import Modal from 'app/Layout/Modal';

interface PermissionByRole {
  label: string;
  roles: {
    admin: string;
    editor: string;
    collaborator: string;
  };
}
const permissionsByRole: PermissionByRole[] = [
  {
    label: 'Create new entities and upload documents',
    roles: { admin: 'full', editor: 'full', collaborator: 'full' },
  },
  {
    label: 'Create table of contents',
    roles: { admin: 'full', editor: 'full', collaborator: 'full' },
  },
  {
    label: 'View entities',
    roles: { admin: 'full', editor: 'full', collaborator: 'partial' },
  },
  {
    label: 'Edit metadata of entities',
    roles: { admin: 'full', editor: 'full', collaborator: 'partial' },
  },
  {
    label: 'Delete entities and documents',
    roles: { admin: 'full', editor: 'full', collaborator: 'partial' },
  },
  {
    label: 'Share edit access with other users',
    roles: { admin: 'full', editor: 'full', collaborator: 'partial' },
  },
  {
    label: 'Create connections and references',
    roles: { admin: 'full', editor: 'full', collaborator: 'partial' },
  },
  {
    label: 'Share entities with the public',
    roles: { admin: 'full', editor: 'full', collaborator: 'none' },
  },
  {
    label: 'Manage site settings and configuration',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Add/delete users and assign roles',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Configure filters',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Add/edit translations',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Configure templates ',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Create and edit thesauri',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
  {
    label: 'Create connection types',
    roles: { admin: 'full', editor: 'none', collaborator: 'none' },
  },
];

const permissionIcons = {
  full: { icon: 'check', className: 'label-success' },
  partial: { icon: 'user-check', className: 'label-info' },
  none: { icon: 'times', className: 'label-warning' },
};

type PermissionCellParams = 'full' | 'partial' | 'none';
type userRoles = 'collaborator' | 'editor' | 'admin';

export interface PermissionsListProps {
  isOpen: boolean;
  onClose: () => void;
  rolePermissions?: PermissionByRole[];
}

export const PermissionsList = ({
  isOpen,
  onClose,
  rolePermissions = permissionsByRole,
}: PermissionsListProps) => (
  <Modal isOpen={isOpen} type="content" className="permissions-modal">
    <Modal.Body>
      <table className="permissions-list">
        <thead>
          <tr>
            <th>
              <Translate>Permission</Translate>
            </th>
            <th>
              <Translate>Collaborator</Translate>
            </th>
            <th>
              <Translate>Editor</Translate>
            </th>
            <th>
              <Translate>Admin</Translate>
            </th>
          </tr>
        </thead>
        <tbody>
          {rolePermissions.map(permission => (
            <tr key={permission.label}>
              <td>
                <Translate>{permission.label}</Translate>
              </td>
              {['collaborator', 'editor', 'admin'].map(role => {
                const roleIcon =
                  permissionIcons[permission.roles[role as userRoles] as PermissionCellParams];
                return (
                  <td key={role}>
                    <Icon icon={roleIcon.icon} className={roleIcon.className} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="legend">
        <Translate>Legend</Translate>
        <div className="legend-item">
          <Icon icon="user-check" className="label-info" />
          {'  '}
          <Translate>Permission on entities explicitly shared with the user</Translate>
        </div>
      </div>
    </Modal.Body>
    <Modal.Footer>
      <button type="button" className="btn btn-default pristine" onClick={onClose}>
        <Translate>Close</Translate>
      </button>
    </Modal.Footer>
  </Modal>
);
