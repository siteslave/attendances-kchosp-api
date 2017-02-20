'use strict';
require('dotenv').config();

import * as express from 'express';
import * as path from 'path';
import * as favicon from 'serve-favicon';
import * as logger from 'morgan';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as json2xls from 'json2xls';

import { Jwt } from './models/jwt';
const jwt = new Jwt();

import indexRoute from './routes/index';
import adminRoute from './routes/admin';
import loginRoute from './routes/login';
import usersRoute from './routes/users';

const app: express.Express = express();

//view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname,'public','favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(json2xls.middleware);

let userAuth = (req, res, next) => {
  let token: string = null;

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else {
    token = req.body.token;
  }

  jwt.verify(token)
    .then((decoded: any) => {
      if (decoded.userType == '2') { // admin
        req.decoded = decoded;
        // console.log(req.decoded);
        next();
      } else {
        return res.send({ ok: false, error: 'Permission denied!' });
      }
    }, err => {
      return res.send({
        ok: false,
        error: 'No token provided.',
        code: 403
      });
    });
}

let adminAuth = (req, res, next) => {
  let token: string = null;

  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  } else {
    token = req.body.token;
  }

  console.log(req.headers);
  
  jwt.verify(token)
    .then((decoded: any) => {
      if (decoded.userType == '1') { // admin
        req.decoded = decoded;
        console.log(req.decoded);
        next();
      } else {
        return res.send({ ok: false, error: 'Permission denied!' });
      }
    }, err => {
      return res.send({
        ok: false,
        error: 'No token provided.',
        code: 403
      });
    });
}

app.use('/login', loginRoute);
app.use('/admin', adminAuth, adminRoute);
app.use('/users', userAuth, usersRoute);
app.use('/', indexRoute);

//catch 404 and forward to error handler
app.use((req, res, next) => {
  var err = new Error('Not Found');
  err['status'] = 404;
  next(err);
});

//error handlers

//development error handler
//will print stacktrace
if (process.env.NODE_ENV === 'development') {
  app.use((err: Error, req, res, next) => {
    res.status(err['status'] || 500);
    console.log(err);
  });
}

//production error handler
// no stacktrace leaked to user
app.use((err: Error, req, res, next) => {
  res.status(err['status'] || 500);
  console.log(err);
});

export default app;
