/*
    Reads the already generated file with list of variants in it. It now 
    extracts all feature data of each variant and generates 'variants'
    folder and adds feature information in specification file of it.

    argv[2] - path to data folder 
 */
var phantom = require('phantom'),
    fs = require('fs'),
    dataDirPath = process.argv[2],
    phantomQueue = [],
    phantomCount = 0,
    missingVariants;
    
fs.readFile('missing.json', {
    encoding: 'utf-8'
}, function(err, missingString) {
    missingVariants = JSON.parse(missingString);
});

if (dataDirPath.substr(-1) !== '/') {
    console.log('Use trailing slash. Terminating');
    process.exit();
}
fs.readdir(dataDirPath, function (err, files) {
    files.forEach(function (file) {
        fs.realpath(dataDirPath + file, function(err, makePath) {
            fs.stat(makePath, function (err, stats) {
                if (stats.isDirectory()) {
                    processMakeDirectory(makePath);
                }
            });
        });
    });
});

function processMakeDirectory(makePath) {
    fs.readdir(makePath, function(err, files) {
         files.forEach(function (file) {
            var modelPath = makePath + '/' + file;
            fs.realpath(modelPath, function (err, modelRealPath) {
                if (!err) {
                    fs.stat(modelRealPath, function (err, stats) {
                        if (!err) {
                            if (stats.isDirectory()) {
                                processModelDirectory(modelRealPath);
                            }
                        }
                    });
                }
            });
        });
    });
}

function processModelDirectory(modelRealPath){
    fs.readdir(modelRealPath, function (err, files) {
        if (!err) {
            files.forEach(function (file) {
                if (file.substr('-4') === 'json') {
                    var variantFilePath = modelRealPath + '/' + file;
                    processVariantsFile(modelRealPath, file);
                }
            });
        }
    });
}

function processVariantsFile(modelRealPath, variantFile) {
    var variantFilePath = modelRealPath + '/' + variantFile;
    console.log(variantFilePath);
    fs.readFile(variantFilePath, {
        encoding: 'utf-8'
    }, function (err, variantsJSONString) {
        if (!err) {
            var variants = JSON.parse(variantsJSONString);
            variants.forEach(function (oVariant) {
                if (!oVariant.discontinued && missingVariants.indexOf(oVariant.name) >= 0) {
                    phantomQueue.push({
                        variant: oVariant,
                        path: modelRealPath
                    });
                    if (phantomCount < 20) {
                        phantomCount++;
                        getFeatures();
                    }
                }
            });
        }
    });
}

function getFeatures() {
    var phantomData = phantomQueue.shift(),
        oVariant = phantomData.variant,
        modelRealPath = phantomData.path,
        detailsHref = oVariant.href,
        name = oVariant.name,
        featuresHref = detailsHref.replace('details', 'features');

    phantom.create({
            onExit: function () {
                phantomQueue.length && getFeatures();
            }
        },function (ph) {
        ph.createPage(function (page) {
            page.open(featuresHref, function (status) {
                console.log("opened " + name, status);
                page.evaluate(extractFeatures, function (featuresJSON) {
                    var variantFileName = name.replace(/\ |\//g, '_'),
                        variantSpecPath = modelRealPath + '/variants/' + variantFileName + '.json';
                    // Put features JSON inside spec JSON
                    fs.readFile(variantSpecPath, function(err, specJSONString) {
                        var specJSON = JSON.parse(specJSONString),
                            detailsJSONString;

                        if (specJSON) {
                            specJSON.features = [featuresJSON];
                            detailsJSONString = JSON.stringify(specJSON, null, 2);
                            
                            // Update variant file
                            fs.writeFile(variantSpecPath, detailsJSONString, function (err) {
                                !err && console.log(variantFileName, 'updated!');
                            });
                        }
                    });
                });
                ph.exit();
            });
        });
    });
}

function extractFeatures() {
    var features = {};
    $('div.mid-box table').each(function (index, dTable) {
        var $table = $(dTable),
            heading;
        $table.find('tr th').each(function (thIndex, dTh) {
            if (thIndex === 0) {
                heading = $(dTh).text().trim();
                features[heading] = [];
            }
        });
        
        $table.find('tr').each(function (trIndex, dTr) {
            if (trIndex === 0) {
                return;
            } else {
                features[heading].push({
                    key: $(dTr).find('td')[0].textContent.trim(),
                    value: $(dTr).find('td')[1].textContent.trim()
                });
            }
        });
    });
    return features;
}

