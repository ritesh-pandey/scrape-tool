/*
    Reads already generated make file and extracts model data from them. It 
    generates '<model>.json' file for each make.
    
    argv[2] - path to data folder 
 */

var phantom = require('phantom')
    fs = require('fs'),
    phantomQueue = [],
    phantomStarted = false;
    
fs.readFile(process.argv[2], {
    encoding: 'utf-8'
}, function (err, makeJSONString) {
    var makes = JSON.parse(makeJSONString);
    makes.forEach(function (oMake) {
        phantomQueue.push({
            make: oMake
        });
        if (!phantomStarted) {
            phantomStarted = true;
            startPhantom();
        }
    });
});

function getModels() {
    var models = [];

    $('#divModels .href-title').each(function (index, dAnchor) {
        models.push({
            name: dAnchor.text,
            href: dAnchor.href
        });
    });

    $('#discontinuedModels a.f-small').each(function (index, dAnchor) {
        models.push({
            name: dAnchor.text,
            href: dAnchor.href,
            discontinued: true
        });
    });
    return models;
}

function startPhantom() {
    var phantomData = phantomQueue.shift(),
        oMake = phantomData.make,
        href = oMake.href,
        name = oMake.name;

    phantom.create({
            onExit: function() {
                phantomQueue.length && startPhantom();
            }
        }, function (ph) {
        ph.createPage(function (page) {
            page.open(href, function (status) {
                console.log('opened', name, status);
                page.evaluate(getModels, function (modelsJSON) {
                    var snakecaseName = name.replace(/\ /g, '_'),
                        dirName = './data_/' + snakecaseName + '/';
                        fileName = snakecaseName + '.json',
                        modelsJSONString = JSON.stringify(modelsJSON, null, 2);

                    fs.mkdir(dirName, function () {
                        fs.writeFile(dirName + fileName, modelsJSONString, function (err) {
                            if (err) throw err;
                            console.log(name, 'saved!');
                        });
                    });
                    ph.exit();
                });
            });
        });
    });
}
