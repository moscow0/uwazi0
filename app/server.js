/* eslint-disable no-console */

import bodyParser from 'body-parser';
import compression from 'compression';
import express from 'express';
import promBundle from 'express-prom-bundle';

import helmet from 'helmet';
import { Server } from 'http';
import mongoose from 'mongoose';
import path from 'path';

import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import { appContextMiddleware } from 'api/utils/appContextMiddleware';
import { requestIdMiddleware } from 'api/utils/requestIdMiddleware';
import uwaziMessage from '../message';
import apiRoutes from './api/api';
import privateInstanceMiddleware from './api/auth/privateInstanceMiddleware';
import authRoutes from './api/auth/routes';
import { config } from './api/config';

import { migrator } from './api/migrations/migrator';
import errorHandlingMiddleware from './api/utils/error_handling_middleware';
import { handleError } from './api/utils/handleError.js';
import serverRenderingRoutes from './react/server.js';
import { DB } from './api/odm';
import { tenants } from './api/tenants/tenantContext';
import { multitenantMiddleware } from './api/utils/multitenantMiddleware';
import { routesErrorHandler } from './api/utils/routesErrorHandler';
import { closeSockets } from './api/socketio/setupSockets';
import { permissionsContext } from './api/permissions/permissionsContext';

import { startLegacyServicesNoMultiTenant } from './startLegacyServicesNoMultiTenant';

mongoose.Promise = Promise;

const app = express();
const metricsMiddleware = promBundle({
  normalizePath: [
    ['^/api/files/(.*\\..*)', '/api/files/#filename'],
    ['^/uploaded_documents/(.*\\..*)', '/uploaded_documents/#filename'],
    ['^/.*\\.(js|css).*', '/#filename'],
    ['^/public/(.*\\..*)', '/public/#filename'],
    ['^/flags/.*', '/flags/#filename'],
    ['^/assets/(.*\\..*)', '/assets/#filename'],
    ['.*/entity/.*', '/entity/#id'],
    ['.*/document/.*', '/document/#id'],
    ['.*/page/.*', '/page/#id'],
    ['.*/library', '/library/'],
  ],
  includeMethod: true,
  includePath: true,
  customLabels: {
    port: config.PORT,
    env: config.ENVIRONMENT,
  },
  promClient: {
    collectDefaultMetrics: {},
  },
});

app.use(metricsMiddleware);
if (config.sentry.dsn) {
  Sentry.init({
    release: config.VERSION,
    dsn: config.sentry.dsn,
    environment: config.ENVIRONMENT,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
      new Tracing.Integrations.Mongo({
        useMongoose: true,
      }),
    ],
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

routesErrorHandler(app);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const http = Server(app);

const uncaughtError = error => {
  handleError(error, { uncaught: true });
  throw error;
};

process.on('unhandledRejection', uncaughtError);
process.on('uncaughtException', uncaughtError);

const oneYear = 31557600;

let maxage = 0;
if (app.get('env') === 'production') {
  maxage = oneYear;
}

app.use(compression());
app.use(express.static(path.resolve(__dirname, '../dist'), { maxage }));
app.use('/public', express.static(config.publicAssets));
app.use(/\/((?!remotepublic).)*/, bodyParser.json({ limit: '1mb' }));

app.use(appContextMiddleware);

// this middleware should go just before any other that accesses to db
app.use(multitenantMiddleware);
app.use(requestIdMiddleware);
let dbAuth = {};

if (process.env.DBUSER) {
  dbAuth = {
    auth: { authSource: 'admin' },
    user: process.env.DBUSER,
    pass: process.env.DBPASS,
  };
}

console.info('==> Connecting to', config.DBHOST);
DB.connect(config.DBHOST, dbAuth).then(async () => {
  await tenants.setupTenants();
  authRoutes(app);
  app.use(privateInstanceMiddleware);
  app.use('/flag-images', express.static(path.resolve(__dirname, '../dist/flags')));

  apiRoutes(app, http);
  serverRenderingRoutes(app);
  if (config.sentry.dsn) {
    app.use(Sentry.Handlers.errorHandler());
  }
  app.use(errorHandlingMiddleware);
  if (config.externalServices) {
    // eslint-disable-next-line global-require
    require('./worker');
  }
  if (!config.multiTenant && !config.clusterMode) {
    await tenants.run(async () => {
      const shouldMigrate = await migrator.shouldMigrate();
      if (shouldMigrate) {
        console.error(
          '\x1b[33m%s\x1b[0m',
          '==> Your database needs to be migrated, please run:\n\n yarn migrate & yarn reindex\n\n'
        );
        process.exit(1);
      }
    });
  }

  const bindAddress = { true: 'localhost' }[process.env.LOCALHOST_ONLY];
  const port = config.PORT;

  http.listen(port, bindAddress, async () => {
    await tenants.run(async () => {
      permissionsContext.setCommandContext();
      await startLegacyServicesNoMultiTenant();
    });

    console.info(
      '==> 🌎 Listening on port %s. Open up http://localhost:%s/ in your browser.',
      port,
      port
    );

    if (process.env.HOT) {
      console.info('');
      console.info('==> 📦 webpack is watching...');
      console.info(uwaziMessage);
    }
  });

  process.on('SIGINT', () => {
    process.stdout.write('SIGINT signal received.\r\n');
    http.close(error => {
      process.stdout.write('Gracefully closing express connections\r\n');
      if (error) {
        process.stderr.write(error.toString());
        process.exit(1);
      }

      DB.disconnect().then(() => {
        process.stdout.write('Disconnected from database\r\n');
        process.stdout.write('Server closed succesfully\r\n');
        process.exit(0);
      });
    });
    closeSockets();
  });
});
