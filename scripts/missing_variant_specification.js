/*
    Reads already generated model file and checks missing variants 
    specification files.

    It generates 'missing_specification.json' file for variants with missing colors
    
    argv[2] - path to data folder 
 */

var phantom = require('phantom')
    fs = require('fs')
    dataDirPath = process.argv[2],
    phantomQueue = [],
    phantomCount = 0;
    
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
    fs.readFile(variantFilePath, {
        encoding: 'utf-8'
    }, function (err, variantsJSONString) {
        if (!err) {
            var variants = JSON.parse(variantsJSONString);
            variants.forEach(function (oVariant) {
                if (!oVariant.discontinued) {
                    if (!(fs.existsSync(modelRealPath + '/variants/' + oVariant.name.replace(/\ |\//g, '_') + '.json'))) {
                        phantomQueue.push(oVariant.name);
                        fs.writeFile('missing_specification.json', JSON.stringify(phantomQueue, null, 2), function (err) {
                            !err && console.log(oVariant.name, 'added!');
                        });
                    }
                }
           });
        }
    });
}

function getSpecifications() {
    var phantomData = phantomQueue.shift(),
        oVariant = phantomData.variant,
        modelRealPath = phantomData.path,
        detailsHref = oVariant.href,
        name = oVariant.name,
        specificationsHref = detailsHref.replace('details', 'specifications');

    phantom.create({
        onExit: function () {
            phantomQueue.length && getSpecifications();
        }
    }, function (ph) {
        ph.createPage(function (page) {
            page.open(specificationsHref, function (status) {
                console.log("opened " + name, status);
                page.evaluate(extractSpecifications, function (specificationsJSON) {
                    var variantFileName = name.replace(/\ /g, '_'),
                        specificationJSONString = JSON.stringify(specificationsJSON, null, 2),
                        variantSpecPath = modelRealPath + '/variants/' + variantFileName + '.json';
                    fs.mkdir(modelRealPath + '/variants/', function (err) {
                        fs.writeFile(variantSpecPath, specificationJSONString, function (err) {
                            if (!err) {
                                console.log(variantFileName, 'written!');
                            }
                        });
                    })    
                });
                ph.exit();
            });
        });
    });
}

function extractSpecifications() {
    var specs = {};
    $('div.mid-box table').each(function (index, dTable) {
        var $table = $(dTable),
            heading;
        $table.find('tr th').each(function (thIndex, dTh) {
            if (thIndex === 0) {
                heading = $(dTh).text();
                specs[heading] = [];
            }
        });
        
        $table.find('tr').each(function (trIndex, dTr) {
            if (trIndex === 0) {
                return;
            } else {
                specs[heading].push({
                    key: $(dTr).find('td')[0].textContent,
                    value: $(dTr).find('td')[1].textContent
                });
            }
        });
    });
    return specs;
}

