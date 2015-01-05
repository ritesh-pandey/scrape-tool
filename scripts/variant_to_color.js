/*
    Reads the already generated features file and adds color information to it.

    Also, uses 'missing_colors.json' file to update selected variants only.
    Generate this file using 'missing_variant_color.js'
    
    argv[2] - path to data folder 
 */
var phantom = require('phantom'),
    fs = require('fs'),
    dataDirPath = process.argv[2],
    phantomQueue = [],
    phantomCount = 0,
    missingColors;
    
if (dataDirPath.substr(-1) !== '/') {
    console.log('Use trailing slash. Terminating');
    process.exit();
}

fs.readFile('missing_colors.json', {
    encoding: 'utf-8'
}, function (err, missingJSONString) {
   if (!err) {
        missingColors = JSON.parse(missingJSONString);
   } 
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
    console.log(variantFilePath);
    fs.readFile(variantFilePath, {
        encoding: 'utf-8'
    }, function (err, variantsJSONString) {
        if (!err) {
            var variants = JSON.parse(variantsJSONString);
            variants.forEach(function (oVariant) {
                if (!oVariant.discontinued && missingColors.indexOf(oVariant.name) >= 0) {
                    phantomQueue.push({
                        variant: oVariant,
                        path: modelRealPath
                    });
                    if (phantomCount < 20) {
                        phantomCount++;
                        getColors();
                    }
                }
            });
        }
    });
}

function getColors() {
    var phantomData = phantomQueue.shift(),
        oVariant = phantomData.variant,
        modelRealPath = phantomData.path,
        detailsHref = oVariant.href,
        name = oVariant.name,
        colorsHref = detailsHref.replace('details', 'colors');

    phantom.create({
        onExit: function () {
            phantomQueue.length && getColors();
        }        
    }, function (ph) {
        ph.createPage(function (page) {
            page.open(colorsHref, function (status) {
                console.log("opened " + name, status);
                page.evaluate(extractColors, function (colorsJSON) {
                    var variantFileName = name.replace(/\ |\//g, '_'),
                        variantSpecPath = modelRealPath + '/variants/' + variantFileName + '.json';
                    // Put features JSON inside spec JSON
                    fs.readFile(variantSpecPath, function(err, specJSONString) {
                        var specJSON = JSON.parse(specJSONString),
                            detailsJSONString;

                        if (specJSON) {
                            specJSON.colors = colorsJSON;
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

function extractColors() {
    var colors = [];
    $('table#dlColors td[valign="top"]').each(function (index, dTd) {
        var $td = $(dTd),
            colorName,
            colorCode;
        $td.find('> div > div').each(function (divIndex, dDiv) {
            if (divIndex === 0) {
                colorCode = dDiv.style.backgroundColor;
            } else if (divIndex === 1) {
                colorName = dDiv.textContent.trim();
            }
        });
        colors.push({
            key: colorName,
            value: colorCode
        });
    });
    return colors;
}

