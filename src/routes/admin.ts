'use strict';

import * as express from 'express';
import * as multer from 'multer';

import * as path from 'path';
import * as fs from 'fs';
import * as moment from 'moment';
import * as fse from 'fs-extra';
import * as pdf from 'html-pdf';
import * as gulp from 'gulp';
import * as gulpData from 'gulp-data';
import * as gulpPug from 'gulp-pug';
import * as rimraf from 'rimraf';
import * as json2xls from 'json2xls';
import * as _ from 'lodash';

import { unitOfTime } from 'moment';

import { IConnection } from 'mysql';

import { Connection } from '../models/connection';
import { AttendancesModel } from '../models/attendances';

const connection = new Connection();
const attendancesModel = new AttendancesModel();

// const upload = multer({ dest: 'uploads/' })
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    let _ext = path.extname(file.originalname);
    cb(null, Date.now() + _ext)
  }
})

var upload = multer({ storage: storage })

const router = express.Router();

router.post('/upload', upload.single('file'), (req, res, next) => {
  const csvFile = req.file.path;
  const ext = path.extname(csvFile);
  const startDate = req.body.start;
  const endDate = req.body.end;
  // console.log(req.body);

  if (ext === '.csv') {
    let csvData = null;

    if (process.env.IMPORT_FILE_ENCODING == 'UCS2') {
      csvData = fs.readFileSync(csvFile, 'ucs2');
    } else {
      csvData = fs.readFileSync(csvFile, 'utf8');
    }

    let _data = csvData.toString().split("\n");
    delete _data[0];
    let items = [];

    _data.forEach((v, i) => {
      if (v) {
        let arrItem = v.toString().split(",");
        // console.log(arrItem);

        let employeeCode = arrItem[5];
        let checkinDate = moment(arrItem[3], 'DD/MM/YYYY HH:mm:ss').format('YYYY-MM-DD');
        let checkinTime = moment(arrItem[3], 'DD/MM/YYYY HH:mm:ss').format('HH:mm:ss');
        let importedDate = moment().format('YYYY-MM-DD HH:mm:ss');

        if (employeeCode) {
          // console.log(arrItem[3])
          let obj = [];
          obj.push(employeeCode);
          obj.push(checkinDate);
          obj.push(checkinTime);
          obj.push(importedDate);

          let isBetween = moment(checkinDate).isBetween(startDate, endDate, null, '[]');
          if (isBetween) {
            items.push(obj);
          }
        }
      }

    });

    // console.log(items);

    if (items.length) {
      let total = 0;
      let _conn;

      connection.getConnection()
        .then((conn: IConnection) => {
          _conn = conn;
          return attendancesModel.removeAttendances(_conn, startDate, endDate)
        })
        .then(() => {
          return attendancesModel.saveAttendances(_conn, items);
        })
        .then((results: any) => {
          total = results.affectedRows;
          let importedAt = moment().format('YYYY-MM-DD HH:mm:ss');
          return attendancesModel.saveImportedLog(_conn, importedAt, startDate, endDate, total);
        })
        .then(() => {
          _conn.release();
          fse.removeSync(csvFile);
          res.send({ ok: true, total: total });
        })
        .catch(err => {
          fse.removeSync(csvFile);
          res.send({ ok: false, message: err });
        });

    } else {
      fse.removeSync(csvFile);
      res.send({ ok: true, total: 0 });
    }
  } else {
    res.send({ ok: false, message: 'รูปแบบไฟล์ไม่ถูกต้อง' });
  }
});

router.get('/imported-logs', (req, res, next) => {

  connection.getConnection()
    .then((conn: IConnection) => {
      attendancesModel.getImportedLog(conn)
        .then((results: any) => {
          conn.release();
          let data = [];
          results.forEach(v => {
            let obj: any = {};
            obj.importedAt = `${moment(v.imported_at).format('D')} ${moment(v.imported_at).locale('th').format('MMM')} ${moment(v.imported_at).get('year') + 543} ${moment(v.imported_at).format('HH:mm')}`;
            obj.start = `${moment(v.start_date).format('D')} ${moment(v.start_date).locale('th').format('MMM')} ${moment(v.start_date).get('year') + 543}`;
            obj.end = `${moment(v.end_date).format('D')} ${moment(v.end_date).locale('th').format('MMM')} ${moment(v.end_date).get('year') + 543}`;
            obj.total = v.total;
            data.push(obj);
          });

          res.send({ ok: true, rows: data });
        })
        .catch(error => {
          console.log(error);
          res.send({
            ok: false,
            code: 500,
            message: "Server error!"
          })
        });
    })
});

router.get('/process-logs', (req, res, next) => {

  connection.getConnection()
    .then((conn: IConnection) => {
      attendancesModel.getProcessLog(conn)
        .then((results: any) => {
          conn.release();
          let data = [];
          results.forEach(v => {
            let obj: any = {};
            obj.processAt = `${moment(v.process_at).format('D')} ${moment(v.process_at).locale('th').format('MMM')} ${moment(v.process_at).get('year') + 543} ${moment(v.process_at).format('HH:mm')}`;
            obj.month = `${moment(v.start_date).locale('th').format('MMMM')} ${moment(v.start_date).get('year') + 543}`;
            // obj.end = `${moment(v.end_date).format('D')} ${moment(v.end_date).locale('th').format('MMM')} ${moment(v.end_date).get('year') + 543}`;
            obj.total = v.total;
            data.push(obj);
          });

          res.send({ ok: true, rows: data });
        })
        .catch(error => {
          console.log(error);
          res.send({
            ok: false,
            code: 500,
            message: "Server error!"
          })
        });
    })
});

router.get('/initial-logs', (req, res, next) => {

  connection.getConnection()
    .then((conn: IConnection) => {
      attendancesModel.getInitialLog(conn)
        .then((results: any) => {
          conn.release();
          let data = [];
          results.forEach(v => {
            let obj: any = {};
            obj.initialAt = `${moment(v.initial_at).format('D')} ${moment(v.initial_at).locale('th').format('MMM')} ${moment(v.initial_at).get('year') + 543} ${moment(v.initial_at).format('HH:mm')}`;
            let m = `${v.iyear}-${v.imonth}`
            obj.month = `${moment(m, 'YYYY-MM').locale('th').format('MMMM')} ${moment(m, 'YYYY-MM').get('year') + 543}`;
            data.push(obj);
          });

          res.send({ ok: true, rows: data });
        })
        .catch(error => {
          console.log(error);
          res.send({
            ok: false,
            code: 500,
            message: "Server error!"
          })
        });
    })
});

router.post('/process-summary', (req, res, next) => {
  let start = req.body.start;
  let end = req.body.end;
  if (start && end) {
    connection.getConnection()
      .then((conn: IConnection) => {
        // console.log('Remove old data')
        return attendancesModel.processSummary(conn, start, end)
      })
      .then((results: any) => {
        res.send({ ok: true, rows: results });
      })
      .catch(err => {
        res.send({ ok: false, message: err })
      })
  } else {
    res.send({ ok: false, message: 'ข้อมูลไม่ครบถ้วน' })
  }

});

router.post('/process', (req, res, next) => {
  let y = req.body.y;
  let m = req.body.m;

  if (y && m) {
    let ym = `${y}-${m}`;
    let _yearMonth = moment(ym, 'YYYY-MM');
    let unitTime: unitOfTime.StartOf = 'month';
    let start = moment(_yearMonth).startOf(unitTime).format('YYYY-MM-DD');
    let end = moment(_yearMonth).endOf(unitTime).format('YYYY-MM-DD');

    let _conn: any;
    let total = 0;

    connection.getConnection()
      .then((conn: IConnection) => {
        _conn = conn;
        // console.log('Remove old data')
        return attendancesModel.removeOldProcess(_conn, start, end)
      })
      .then((results: any) => {
        // console.log('removed!')
        return attendancesModel.doProcess(_conn, start, end)
      })
      .then((results: any) => {
        let processAt = moment().format('YYYY-MM-DD HH:mm:ss');
        total = results.affectedRows;
        // console.log(processAt, start, end, total)
        return attendancesModel.saveProcessLog(_conn, processAt, start, end, total);
      })
      .then(() => {
        res.send({ ok: true, total: total });
      })
      .catch(err => {
        res.send({ ok: false, message: err })
      })
  } else {
    res.send({ ok: false, message: 'ข้อมูลไม่ครบถ้วน' })
  }

});

router.post('/initial', (req, res, next) => {
  let y = req.body.y;
  let m = req.body.m;

  if (y && m) {
    let ym = `${y}-${m}`;
    let _yearMonth = moment(ym, 'YYYY-MM');
    let unitTime: unitOfTime.StartOf = 'month';
    let start = moment(_yearMonth).startOf(unitTime).format('YYYY-MM-DD');
    let end = moment(_yearMonth).endOf(unitTime).format('YYYY-MM-DD');

    let employees = [];
    let services = [];
    let _conn = null;
    let total = 0;

    connection.getConnection()
      .then((conn: IConnection) => {
        // get employees
        _conn = conn;
        attendancesModel.getInitialEmployees(conn, start, end)
          .then((results: any) => {
            if (results.length) {
              results.forEach(v => {
                employees.push(v.employee_code);
              });

              let _endDate = moment(end, 'YYYY-MM-DD').get('date');
              let serviceDates = [];
              for (let i = 0; i <= _endDate - 1; i++) {
                let _date = moment(start, 'YYYY-MM-DD').add(i, "days").format("YYYY-MM-DD");
                serviceDates.push(_date);
              }

              employees.forEach((v) => {
                serviceDates.forEach(d => {
                  let obj = [];
                  obj.push(v);
                  obj.push(d);
                  obj.push('1');
                  obj.push('N');
                  services.push(obj);
                });
              });
              attendancesModel.saveInitial(_conn, services)
                .then((results: any) => {
                  total = results.affectedRows;
                  let initialAt = moment().format('YYYY-MM-DD HH:mm:ss');
                  return attendancesModel.saveInitialLog(_conn, initialAt, y, m);
                })
                .then(() => {
                  res.send({ ok: true, total: total })
                })
                .catch(err => {
                  res.send({ ok: false, message: err })
                })
            } else {
              res.send({ ok: true, total: 0 });
            }
          })
          .catch(err => {
            res.send({ ok: false, message: err })
          })
      });
  } else {
    res.send({ ok: false, message: 'ข้อมูลไม่ครบถ้วน' })
  }

});

//------ print pdf ------//

router.get('/print/:employeeCode/:startDate/:endDate', (req, res, next) => {
  let startDate = req.params.startDate;
  let endDate = req.params.endDate;
  let employeeCode = req.params.employeeCode;

  fse.ensureDirSync('./templates/html');
  fse.ensureDirSync('./templates/pdf');

  var destPath = './templates/html/' + moment().format('x');
  fse.ensureDirSync(destPath);

  let json: any = {};

  // json.start_date = `${moment(startDate).format('DD/MM')}/${moment(startDate).get('year') + 543}`;
  // json.end_date = `${moment(endDate).format('DD/MM')}/${moment(endDate).get('year') + 543}`;
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
      json.employee = results[0];
      return attendancesModel.getEmployeeWorkDetail(_conn, employeeCode, startDate, endDate);
    })
    .then((results: any) => {
      json.results = [];
      let startDateProcess = moment(startDate, 'YYYY-MM-DD').startOf('month').format('YYYY-MM-DD');
      const _startDate = +moment(startDateProcess).startOf('month').format('DD');
      const _endDate = +moment(startDateProcess).endOf('month').format('DD');

      for (let x = 0; x <= _endDate - 1; x++) {
        const obj: any = {};
        obj.work_date = moment(startDateProcess, 'YYYY-MM-DD').add(x, 'days').format('YYYY-MM-DD');
        obj.thdate = `${moment(startDateProcess, 'YYYY-MM-DD').add(x, 'days').format('D')} ${moment(startDateProcess, 'YYYY-MM-DD').add(x, 'days').locale('th').format('MMM')} ${moment(startDateProcess, 'YYYY-MM-DD').add(x, 'days').get('year') + 543}`;
        //  console.log(obj.thdate)
        obj.weekday = +moment(startDateProcess, 'YYYY-MM-DD').add(x, 'days').format('d');
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
        // console.log(obj);
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
          // footer: {
          //   height: "10mm",
          //   contents: '<span style="color: #444;"><small>Printed: ' + new Date() + '</small></span>'
          // }
        }

        // let employee_name = `${json.employee.first_name} ${json.employee.last_name}`;
        // let pdfName = path.join(destPath, employee.fullname + '-' + moment().format('x') + '.pdf');
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

router.get('/export-excel/:startDate/:endDate', (req, res, next) => {

  let startDate = req.params.startDate;
  let endDate = req.params.endDate;

  let excelFile = moment().format('x') + '.xls';

  if (startDate && endDate) {
    connection.getConnection()
      .then((conn: IConnection) => {
        // console.log('Remove old data')
        return attendancesModel.processSummary(conn, startDate, endDate)
      })
      .then((results: any) => {
        //res.send({ ok: true, rows: results });
        let options = {
          fields: [
            'employee_code', 'employee_name', 'department_name',
            'total_work', 'total_late', 'total_exit_before', 'total_not_exit'
          ]
        };
        // force download
        res.xls(excelFile, results, options);
      })
      .catch(err => {
        res.send({ ok: false, message: err })
      })
  } else {
    res.send({ ok: false, message: 'กรุณาระบุวันที่' })
  }

});


export default router;