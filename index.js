const express = require('express');
const SocketServer = require('ws').Server; 
const app = express(); 
const bodyParser = require('body-parser');
const multer = require('multer');
const xlstojson = require("xls-to-json-lc");
const xlsxtojson = require("xlsx-to-json-lc");
const nanpScript = require('./nanp-script');
const Excel = require('exceljs');
const tempfile = require('tempfile');

app.use(bodyParser.json());
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    var datetimestamp = Date.now();
    cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length -1])
  }
});

var upload = multer({
  storage: storage,
  fileFilter : function(req, file, callback) {
    if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length-1]) === -1) {
      return callback(new Error('Wrong extension type'));
    }
    callback(null, true);
  }
}).single('file');

/** API path that will upload the files */
app.post('/upload', (req, res) => {
  let exceltojson; //Initialization
  upload(req, res, (err) => {
    if(err) {
      res.json({ error_code:1,err_desc:err });
      return;
    }
    /** Multer gives us file info in req.file object */
    if (!req.file) {
      res.json({ error_code:1, err_desc:"No file passed" });
      return;
    }

    if (req.file.originalname.split('.')[req.file.originalname.split('.').length-1] === 'xlsx') {
      exceltojson = xlsxtojson;
    } else {
      exceltojson = xlstojson;
    }
    try {
      exceltojson({
        input: req.file.path,
        output: null,
        lowerCaseHeaders:true
      }, (err, result) => {
        if(err) {
          return res.json({ error_code:1, err_desc:err, data: null });
        } 
        if (!result[0].phonenumber) {
          return res.json( {error_code: 1, err_desc: 'phonenumber field required in excel'})
        }
        const phoneArray = result.map(element => element.phonenumber);
        console.log(phoneArray, 'phoneArray');
        nanpScript.readFile()
        .then(() => {
          const regionArray = nanpScript.compareNumber(phoneArray);
          console.log(regionArray);

          try {
            var workbook = new Excel.Workbook();
            var worksheet = workbook.addWorksheet('My Sheet');

            worksheet.columns = [
              { header: 'Phone Number', key: 'phone', width: 20 },
              { header: 'Region', key: 'region', width: 12 },
            ];
            for (let i = 0; i < phoneArray.length; i++) {
              worksheet.addRow({phone: phoneArray[i], region: regionArray[i]})
            }

            var fileName = 'output.xlsx';

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader("Content-Disposition", "attachment; filename=" + fileName);

            workbook.xlsx.write(res).then(function(){
              res.end();
            });
          } catch(err) {
            console.log('error ocurred: ' + err);
          }
        })
      });
    } catch (e){
      res.json({error_code:1,err_desc:"Corrupted excel file"});
    }
  });
});

app.get('/', function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

var server = app.listen('3000', function() {
  console.log('Server running on port 3000');
});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

const wss = new SocketServer({ server });
wss.on('connection', function connection(ws) {
  console.log("web sockeet connection");
  //on connect message
  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
    connectedUsers.push(message);
  });
  ws.send('message from server at: ' + new Date());
});
