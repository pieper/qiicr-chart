var _ = require("underscore");
var util = require("util");
var cradle = require("cradle");
var fs = require('fs');

/* from Kalli's notes after the meeting with Issa:
 *
Random id replacing MRN/EMPI
age in days
sex
series and studies descriptions
magnetic field strength/scanner model/manufacturer
mracquisitiontype (denotes 2D or 3D)
station id
image thumbnail


Per Randy's request, also include these:

(0018,0020)	Scanning Sequence	1	Description of the type of data taken. Enumerated Values: SE = Spin Echo IR = Inversion Recovery GR = Gradient Recalled EP = Echo Planar RM = Research Mode Note: Multi-valued, but not all combinations are valid (e.g. SE/GR, etc.).

(0018,0021)	Sequence Variant	1	Variant of the Scanning Sequence. Defined Terms: SK = segmented k-space MTC = magnetization transfer contrast SS = steady state TRSS = time reversed steady state SP = spoiled MP = MAG prepared OSP = oversampling phase NONE = no sequence variant

*/

var tags = {
  "id" : "00100020",
  "age" : "00101010",
  "sex" : "00100040",
  "studyDescription" : "00081030",
  "seriesDescription" : "0008103E",
  "studyUID" : "0020000D",
  "fieldStrength" : "00180087",
  "acquisitionType" : "00180023",
  "repetitionTime" : "00180080",
  "echoTime" : "00180081",
  "inversionTime" : "00180082",
  "stationName" : "00081010",
  "scanningSequence" : "00180020",
  "sequenceVariant" : "00180021",
};

// these tags should be mapped to random strings
var randomMapTags = ["id", "studyUID", "stationName"];
var randomMap = {};

//var chronicle = new(cradle.Connection)().database('chronicle');
var chronicle = new(cradle.Connection)().database('ch-babies');

var seriesKeyList = [];
var seriesData = [];

// get a distribution of the number os instances
// in each series in the database
var getAllData  = function() {
  viewOptions = {
    reduce: true,
    group_level: 3,
    stale: 'update_after',
    limit: 100
  };
  chronicle.view('instances/context', viewOptions, function(err,response) {
    if (err) {
      console.log(err);
      return;
    }
    util.inspect(response);
    response.forEach(function(key,row,id) {
      seriesKeyList.push(key);
    });
    getSeriesData();
  });
};


var getSeriesData = function() {
  if (seriesKeyList.length == 0) {
    fs.writeFile("/tmp/test", JSON.stringify(seriesData, null, " "), function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log("The file was saved!");
        }
    }); 
  } else {
    var key = seriesKeyList.pop();
    getOneSeriesData(key, getSeriesData);
  }
};

var getOneSeriesData = function(key, finishedCallback) {

  var seriesUID = key[2][2];

  viewOptions = {
    reduce: false,
    stale: 'update_after',
    include_docs: true,
    limit: 1,
    startkey: seriesUID,
  };
  chronicle.view('instances/seriesInstances', viewOptions, function(err,response) {
    if (err) {
      console.log(err);
      return;
    }
    var dataset = response[0].doc.dataset;

    // randomize the mappings that could be identifiable
    _.each(randomMapTags, function(tag, index, list) {
      if (dataset[tags[tag]]) {
        var tagValue = dataset[tags[tag]].Value;
        if (!randomMap[tagValue]) {
          randomMap[tagValue] = String(Math.floor(Math.random()*100000));
        }
        dataset[tags[tag]].Value = randomMap[tagValue];
      }
    });

    var seriesInfo = {};
    _.each(_.keys(tags), function(key, index, list) {
      seriesInfo[key] = "Unspecified";
      if (dataset[tags[key]]) {
        seriesInfo[key] = dataset[tags[key]].Value;
      }
    });
    seriesData.push(seriesInfo);
    finishedCallback();
  });
};

getAllData();
