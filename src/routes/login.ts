'use strict';

import * as express from 'express';
import * as crypto from 'crypto';

import { IConnection } from 'mysql';
import { Jwt } from '../models/jwt';
import { LoginModel } from '../models/login';

const router = express.Router();
const jwt = new Jwt();
const loginModel = new LoginModel();

router.post('/', (req, res, next) => {
  let username = req.body.username;
  let password = req.body.password;
  let userType = req.body.userType;

  let db = req.db;

  if (username && password && userType) {
    let encPassword = crypto.createHash('md5').update(password).digest('hex');

    let promise: any;
    if (userType == '1') {
      promise = loginModel.adminLogin(db, username, encPassword);
    } else {
      promise = loginModel.userLogin(db, username, encPassword);
    }

    promise
      .then((results: any) => {
        if (results.length) {
          const payload = { userType: userType, fullname: results[0].fullname, employeeCode: results[0].employee_code };
          const token = jwt.sign(payload);
          res.send({ ok: true, token: token })
        } else {
          res.send({ ok: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่าน ไม่ถูกต้อง' })
        }
      })
      .catch(err => {
        console.log(err);
        res.send({ ok: false, message: 'Server error!' });
      })
  } else {
    res.send({ ok: false, message: 'กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน' })
  }
})

export default router;