'use strict';

import * as express from 'express';

const router = express.Router();
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as moment from 'moment';
import * as fse from 'fs-extra';
import * as pdf from 'html-pdf';
import * as gulp from 'gulp';
import * as gulpData from 'gulp-data';
import * as gulpPug from 'gulp-pug';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';

import { unitOfTime } from 'moment';
import { IConnection } from 'mysql';

import { Connection } from '../models/connection';
import { AttendancesModel } from '../models/attendances';
import { UserModel } from '../models/users';

const connection = new Connection();
const attendancesModel = new AttendancesModel();
const userModel = new UserModel();

router.post('/changepass', (req, res, next) => {
  let password = req.body.password;
  let employeeCode = req.decoded.employeeCode;
  let encPassword = crypto.createHash('md5').update(password).digest('hex');

  connection.getConnection()
    .then((conn: IConnection) => {
      return userModel.changePassword(conn, employeeCode, encPassword)
    })
    .then((results: any) => {
      res.send({ ok: true })
    })
    .catch(err => {
      res.send({ ok: false, message: err });
    })
});

router.get('/work-allow', (req, res, next) => {
  connection.getConnection()
    .then((conn: IConnection) => {
      return userModel.getWorkAllow(conn)
    })
    .then((results: any) => {
      let data = [];
      results.forEach(v => {
        let obj: any = {};
        obj.ym = v.ym;
        obj.name = `${moment(v.ym, 'YYYY-MM').locale('th').format('MMMM')} ${moment(v.ym, 'YYYY-MM').get('year') + 543}`;
        data.push(obj);
      });

      res.send({ ok: true, rows: data })
    })
    .catch(err => {
      res.send({ ok: false, message: err });
    })
});

router.post('/work-save', (req, res, next) => {
  let works = req.body.works;
  let ym = req.body.ym;
  let employeeCode = req.decoded.employeeCode;

  let _yearMonth = moment(ym, 'YYYY-MM');
  let unitTime: unitOfTime.StartOf = 'month';
  let start = moment(_yearMonth).startOf(unitTime).format('YYYY-MM-DD');
  let end = moment(_yearMonth).endOf(unitTime).format('YYYY-MM-DD');

  let _works = [];
  works.forEach(v => {
    let obj: any = [];
    obj.push(employeeCode);
    obj.push(v.work_date);
    obj.push(v.work_type);
    obj.push(v.is_process);
    _works.push(obj);
  });

  let _conn: IConnection;

  connection.getConnection()
    .then((conn: IConnection) => {
      _conn = conn;
      return userModel.removeOldWork(conn, employeeCode, start, end)
    })
    .then(() => {
      return userModel.saveWork(_conn, _works);
    })
    .then(() => {
      console.log('remove old process')
      return attendancesModel.removeOldProcessIndividual(_conn, employeeCode, start, end);
    })
    .then(() => {
      console.log('process works')
      return attendancesModel.doProcessIndividual(_conn, employeeCode, start, end);
    })
    .then(() => {
      res.send({ ok: true });
    })
    .catch(err => {
      res.send({ ok: false, message: err });
    })
});

router.post('/work-summary', (req, res, next) => {
  let ym = req.body.ym;
  let employeeCode = req.decoded.employeeCode;

  let _yearMonth = moment(ym, 'YYYY-MM');
  let unitTime: unitOfTime.StartOf = 'month';

  let start = moment(_yearMonth).startOf(unitTime).format('YYYY-MM-DD');
  let end = moment(_yearMonth).endOf(unitTime).format('YYYY-MM-DD');

  const _startDate = +moment(_yearMonth).startOf('month').format('DD');
  const _endDate = +moment(_yearMonth).endOf('month').format('DD');

  // console.log(start, end);

  connection.getConnection()
    .then((conn: IConnection) => {
      return attendancesModel.getEmployeeWorkDetail(conn, employeeCode, start, end);
    })
    .then((results: any) => {
      let data = [];

      for (let x = 0; x <= _endDate - 1; x++) {

        const obj: any = {};
        obj.work_date = moment(start, 'YYYY-MM-DD').add(x, 'days').format('YYYY-MM-DD');
        obj.thdate = `${moment(start, 'YYYY-MM-DD').add(x, 'days').format('D')} ${moment(start, 'YYYY-MM-DD').add(x, 'days').locale('th').format('MMM')} ${moment(start, 'YYYY-MM-DD').add(x, 'days').get('year') + 543}`;
        //  console.log(obj)
        obj.weekday = +moment(start, 'YYYY-MM-DD').add(x, 'days').format('d');
        let idx = _.findIndex(results, { work_date: obj.work_date });
        console.log(idx, results[0].work_date);
        if (idx > -1) {
          obj.in01 = results[idx].in01 ? moment(results[idx].in01, 'HH:mm:ss').format('HH:mm') : '';
          obj.in02 = results[idx].in02 ? moment(results[idx].in02, 'HH:mm:ss').format('HH:mm') : '';
          let _in03 = results[idx].in03 || results[idx].in03_2;
          obj.in03 = _in03 ? moment(_in03, 'HH:mm:ss').format("HH:mm") : '';
          obj.out01 = results[idx].out01 ? moment(results[idx].out01, 'HH:mm:ss').format('HH:mm') : '';
          let _out02 = results[idx].out02 || results[idx].out02_2;
          obj.out02 = _out02 ? moment(_out02, 'HH:mm:ss').format('HH:mm') : '';
          obj.out03 = results[idx].out03 ? moment(results[idx].out03, 'HH:mm:ss').format('HH:mm') : '';
          obj.late = moment(results[idx].in01, 'HH:mm:ss').isAfter(moment('08:45:59', 'HH:mm:ss')) ? 'สาย' : '';
        }
        data.push(obj);
      }

      // results.forEach(v => {
      //   let obj: any = {};
      //   obj.work_date = `${moment(v.work_date).format('D')} ${moment(v.work_date).locale('th').format('MMM')} ${moment(v.work_date).get('year') + 543}`;
      //   obj.in01 = v.in01 ? moment(v.in01, 'HH:mm:ss').format('HH:mm') : '';
      //   obj.in02 = v.in02 ? moment(v.in02, 'HH:mm:ss').format('HH:mm') : '';
      //   let _in03 = v.in03 || v.in03_2;
      //   obj.in03 = _in03 ? moment(_in03, 'HH:mm:ss').format("HH:mm") : '';
      //   obj.out01 = v.out01 ? moment(v.out01, 'HH:mm:ss').format('HH:mm') : '';
      //   let _out02 = v.out02 || v.out02_2;
      //   obj.out02 = _out02 ? moment(_out02, 'HH:mm:ss').format('HH:mm') : '';
      //   obj.out03 = v.out03 ? moment(v.out03, 'HH:mm:ss').format('HH:mm') : '';
      //   obj.late = moment(v.in01, 'HH:mm:ss').isAfter(moment('08:45:59', 'HH:mm:ss')) ? 'สาย' : '';
      //   data.push(obj);
      // });

      res.send({ ok: true, rows: data });

    })
    .catch(err => {
      res.send({ ok: false, message: err });
    });
});

router.post('/work-detail', (req, res, next) => {
  let employeeCode = req.decoded.employeeCode;
  let ym = req.body.ym;
  let _yearMonth = moment(ym, 'YYYY-MM');
  let unitTime: unitOfTime.StartOf = 'month';
  let start = moment(_yearMonth).startOf(unitTime).format('YYYY-MM-DD');
  let end = moment(_yearMonth).endOf(unitTime).format('YYYY-MM-DD');
  let _conn = null;
  connection.getConnection()
    .then((conn: IConnection) => {
      _conn = conn;
      return userModel.getWorkHistory(conn, employeeCode, start, end)
    })
    .then((results: any) => {
      if (results.length) {
        let data = [];
        results.forEach(v => {
          let obj: any = {
            employee_code: v.employee_code,
            work_date: moment(v.work_date).format('YYYY-MM-DD'),
            work_date_label: `${moment(v.work_date).format('D')} ${moment(v.work_date).locale('th').format('MMM')} ${moment(v.work_date).get('year') + 543}`,
            work_type: v.work_type,
            is_process: v.is_process
          }
          data.push(obj);
        })
        res.send({ ok: true, rows: data });
      } else {
        // create time
        let startDate = +moment(start, "YYYY-MM-DD").startOf("month").format("DD");
        let endDate = +moment(start, "YYYY-MM-DD").endOf("month").format("DD");
        let serviceDates = [];

        for (let i = 0; i <= endDate - 1; i++) {
          let _date = moment(start, 'YYYY-MM-DD').add(i, "days").format("YYYY-MM-DD");
          serviceDates.push(_date);
        }

        let services = [];
        serviceDates.forEach(d => {
          let obj = [];
          obj.push(employeeCode);
          obj.push(d);
          obj.push('1');
          obj.push('N');
          services.push(obj);
        });

        attendancesModel.saveInitial(_conn, services)
          .then(() => {
            return userModel.getWorkHistory(_conn, employeeCode, start, end)
          })
          .then((results: any) => {
            let data = [];
            results.forEach(v => {
              let obj: any = {
                employee_code: v.employee_code,
                work_date: moment(v.work_date).format('YYYY-MM-DD'),
                work_date_label: `${moment(v.work_date).format('D')} ${moment(v.work_date).locale('th').format('MMM')} ${moment(v.work_date).get('year') + 543}`,
                work_type: v.work_type,
                is_process: v.is_process
              }
              data.push(obj);
            })
            res.send({ ok: true, rows: data })
          })
          .catch(err => {
            res.send({ ok: false, mesage: err });
          })
      }
    })
    .catch(err => {
      res.send({ ok: false, message: err });
    })
});


router.get('/print/:ym', (req, res, next) => {
  let employeeCode = req.decoded.employeeCode;
  let ym = req.params.ym;
  let _yearMonth = moment(ym, 'YYYY-MM');
  let unitTime: unitOfTime.StartOf = 'month';
  let startDate = moment(_yearMonth).startOf('month').format('YYYY-MM-DD');
  let endDate = moment(_yearMonth).endOf('month').format('YYYY-MM-DD');

  fse.ensureDirSync('./templates/html');
  fse.ensureDirSync('./templates/pdf');

  var destPath = './templates/html/' + moment().format('x');
  fse.ensureDirSync(destPath);

  let json: any = {};

  json.startDate = `${moment(startDate).format('D')} ${moment(startDate).locale('th').format('MMMM')} ${moment(startDate).get('year') + 543}`;
  json.endDate = `${moment(endDate).format('D')} ${moment(endDate).locale('th').format('MMMM')} ${moment(endDate).get('year') + 543}`;

  json.items = [];
  let _conn = null;

  connection.getConnection()
    .then((conn: IConnection) => {
      _conn = conn;
      return attendancesModel.getEmployeeDetail(conn, employeeCode);
    })
    .then(results => {
      // console.log(results);
      json.employee = results[0];
      return attendancesModel.getEmployeeWorkDetail(_conn, employeeCode, startDate, endDate);
    })
    .then((results: any) => {
      // console.log(results);
      json.results = [];
      const _startDate = +moment(_yearMonth).startOf('month').format('DD');
      const _endDate = +moment(_yearMonth).endOf('month').format('DD');

      for (let x = 0; x <= _endDate - 1; x++) {
        const obj: any = {};
        obj.work_date = moment(startDate, 'YYYY-MM-DD').add(x, 'days').format('YYYY-MM-DD');
        obj.thdate = `${moment(startDate, 'YYYY-MM-DD').add(x, 'days').format('D')} ${moment(startDate, 'YYYY-MM-DD').add(x, 'days').locale('th').format('MMM')} ${moment(startDate, 'YYYY-MM-DD').add(x, 'days').get('year') + 543}`;
        //  console.log(obj.thdate)
        obj.weekday = +moment(startDate, 'YYYY-MM-DD').add(x, 'days').format('d');
        let idx = _.findIndex(results, { work_date: obj.work_date });
        if (idx > -1) {
          obj.in01 = results[idx].in01 ? moment(results[idx].in01, 'HH:mm:ss').format('HH:mm') : '';
          obj.in02 = results[idx].in02 ? moment(results[idx].in02, 'HH:mm:ss').format('HH:mm') : '';
          let _in03 = results[idx].in03 || results[idx].in03_2;
          obj.in03 = _in03 ? moment(_in03, 'HH:mm:ss').format("HH:mm") : '';
          obj.out01 = results[idx].out01 ? moment(results[idx].out01, 'HH:mm:ss').format('HH:mm') : '';
          let _out02 = results[idx].out02 || results[idx].out02_2;
          obj.out02 = _out02 ? moment(_out02, 'HH:mm:ss').format('HH:mm') : '';
          obj.out03 = results[idx].out03 ? moment(results[idx].out03, 'HH:mm:ss').format('HH:mm') : '';
          obj.late = moment(results[idx].in01, 'HH:mm:ss').isAfter(moment('08:45:59', 'HH:mm:ss')) ? 'สาย' : '';
        }
        // console.log(obj.work_date);
        console.log(obj);
        json.results.push(obj);
      }

      gulp.task('html', (cb) => {
        return gulp.src('./templates/work-time.pug')
          .pipe(gulpData(() => {
            return json;
          }))
          .pipe(gulpPug())
          .pipe(gulp.dest(destPath));
      });

      gulp.task('pdf', ['html'], () => {
        let html = fs.readFileSync(destPath + '/work-time.html', 'utf8')
        let options = {
          format: 'A4',
          // height: "8in",
          // width: "6in",
          orientation: "portrait",
        }
        var pdfName = `./templates/pdf/attendances-${json.employee.employee_name}-${moment().format('x')}.pdf`;

        pdf.create(html, options).toFile(pdfName, (err, resp) => {
          if (err) {
            rimraf.sync(destPath);
            fse.removeSync(pdfName);
            res.send({ ok: false, message: err });
          } else {
            res.download(pdfName, function () {
              rimraf.sync(destPath);
              fse.removeSync(pdfName);
            });
          }
        });

      });

      gulp.start('pdf');

    })

    .catch(err => {
      res.send({ ok: false, message: err });
    });

});

export default router;