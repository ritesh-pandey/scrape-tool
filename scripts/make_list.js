/*
    Opens the specified webpage and extract all makes present on that page.

    It generates 'make.json' file all makes.
 */

var phantom = require('phantom'),
    fs = require('fs');

phantom.create(function (ph) {
    ph.createPage(function (page) {
        page.open("http://www.carwale.com/new/", function (status) {
            console.log("open status", status);
            page.evaluate(extractMake, function (makeJSON) {
                var makeString = JSON.stringify(makeJSON, null, 2);
                console.log(makeString);
                fs.writeFile('./data_/make.json', makeString, function (err) {
                    !err && console.log('make list written!');
                });
                ph.exit();
            });
        });
    });
});

function extractMake() {
    var make = [];
    $('div.brands-list > div').each(function (index, dDiv) {
        $(dDiv).find('li').each(function (liIndex, dLi) {
            make.push({
                href: $(dLi).find('a')[0].href,
                name: $(dLi).find('a')[0].title
            });
        });
    });
    return make;
}
