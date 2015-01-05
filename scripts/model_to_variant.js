/*
  Reads model file and generates a file with list of variants in it.

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
            if (file.substr(-4) === 'json') {
                fs.readFile(makePath + '/' + file, {
                    encoding: 'utf8'
                }, function (err, modelsJSONString) {
                    processModelFile(err, modelsJSONString, makePath);
                });
            }
        });
    });
}

function processModelFile(err, modelsJSONString, makePath) {
    var models = JSON.parse(modelsJSONString);
    models.forEach(function (oModel) {
        var name = oModel.name,
            snakecaseName = name.replace(/\ /g, '_');
        fs.mkdir(makePath + '/' + snakecaseName, function(err) {
            phantomQueue.push({
                model: oModel,
                path: makePath
            });
            if (phantomCount < 10) {
                phantomCount++;
                startPhantomWork();
            }
        });
    });
}

function startPhantomWork() {
    var phantomData = phantomQueue.shift(),
        oModel = phantomData.model,
        makePath = phantomData.path,
        href = oModel.href,
        name = oModel.name,
        discontinued = oModel.discontinued;

    phantom.create({
        onExit: function () {
            phantomQueue.length && startPhantomWork();
        }
    }, function (ph) {
        ph.createPage(function (page) {
            page.open(href, function (status) {
                var models = [];
                console.log("opened " + name, status);
                if (!discontinued) {
                    page.evaluate(evaluatePage, function (variants) {
                        processVariants(variants, makePath, name);
                    });
                } else {
                    models.push({
                        discontinued: true,
                        name: name,
                        href: href
                    });
                    processDiscontinuedModel(models, makePath, name);
                }
                ph.exit();
            });
        });
    });
}

function evaluatePage() {
    var variants = [];

    $('#tblVersions a.href-title').each(function (index, dAnchor) {
        variants.push({
            name: dAnchor.text,
            href: dAnchor.href
        });
    });
    return variants;
}

function processVariants(variantsJSON, makePath, variantName) {
    var variantNameSnakecase = variantName.replace(/\ |\//g, '_'),
        variantPath = makePath + '/' + variantNameSnakecase + '/',
        variantFileName = variantNameSnakecase + '.json',
        variantsJSONString = JSON.stringify(variantsJSON, null, 2);

    fs.writeFile(variantPath + variantFileName, variantsJSONString, function (err) {
        if (err) throw err;
        console.log(variantName, 'saved!');
    });
}

function processDiscontinuedModel(modelsJSON, makePath, modelName) {
    var modelNameSnakecase = modelName.replace(/\ |\//g, '_'),
        modelPath = makePath + '/' + modelNameSnakecase + '/',
        modelFileName = modelNameSnakecase + '.json',
        modelJSONString = JSON.stringify(modelsJSON, null, 2);

    fs.writeFile(modelPath + modelFileName, modelJSONString, function (err) {
        if (err) throw err;
        console.log(modelName, 'saved!');
    });
}
