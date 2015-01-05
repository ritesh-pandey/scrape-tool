/*
    Reads the already generated file with list of variants in it. It now 
    extracts all specification data of each variant and generates 'variants'
    folder and places specification file in it.

    Also, uses 'missing_specification.json' file to update selected variants 
    only. Generate this file using 'missing_variant_color.js'
    
    argv[2] - path to data folder 
 */
var phantom = require('phantom'),
    fs = require('fs'),
    dataDirPath = process.argv[2],
    phantomQueue = [],
    phantomCount = 0,
    missingVariants;
    
if (dataDirPath.substr(-1) !== '/') {
    console.log('Use trailing slash. Terminating');
    process.exit();
}

fs.readFile('missing_specification.json', {
    encoding: 'utf-8'
}, function(err, missingString) {
    missingVariants = JSON.parse(missingString);
});

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
                if (!oVariant.discontinued && missingVariants.indexOf(oVariant.name) >= 0) {
                    phantomQueue.push({
                        variant: oVariant,
                        path: modelRealPath
                    });
                    if (phantomCount < 20) {
                        phantomCount++;
                        getSpecifications();
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
                    var variantFileName = name.replace(/\ |\//g, '_'),
                        specificationJSONString = JSON.stringify(specificationsJSON, null, 2),
                        variantSpecPath = modelRealPath + '/variants/' + variantFileName + '.json';
                    fs.mkdir(modelRealPath + '/variants/', function (err) {
                        fs.writeFile(variantSpecPath, specificationJSONString, function (err) {
                            if (!err) {
                                console.log(variantFileName, 'written!');
                            } else {
                                console.log(err);
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

