function main() {
    const merchant_id = 
    const days = 60
    const sheet_url = "https://docs.google.com/spreadsheets/d/1S5SDhNO1pouXvGprRAXnwqvVpzNmaGQjPDaUzPONxmQ/copy"
    const priceType = "PRODUCT_TIERS" //supported types 'BRANDS', 'EVENTS', 'LOCATIONS', 'NEIGHBORHOODS', 'PRODUCT_CATEGORIES', 'PRODUCT_TIERS', 'SERVICES', 'SERVICE_CATEGORIES', 'SERVICE_TIERS'
    const language = "de" //supported languages: de, en, es, es-419, fr, it, ja, nl, pl, pt-BR, pt-PT, sv
    const sales_limit = 2 // first time running this script? Please start first with sales_limit = 0. After inserting all products into the spreadsheet you could set this limit > 0.
    const field = "customLabel0" // customLabel0, customLabel1, customLabel2, customLabel3, customLabel4
    
    const sh = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("List")
    const sales = getStats(days);
    const products = connectMerchant({merchant_id, stats:sales, sh, sales_limit, field});
    Logger.log('The items info is collected' + products.length + ' products are loaded')
    const labels = [...Object.keys(products)]
    const labelsForReference = labels.map(label => [label]);
    // Write all Labels to Sheet for Reference
    const ss_labels = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("Labels")
    ss_labels.clear()
    ss_labels.getRange(1, 1, 1, 1).setValue("Labels");
    ss_labels.getRange(ss_labels.getLastRow() + 1, 1, labelsForReference.length, 1).setValues(labelsForReference);
   
  
    const labelsToSearch = loadAllLabels();
    Logger.log("labelsToSearch: " + labelsToSearch.length)
    Logger.log(labelsToSearch)
    const relevantLabels = labelsToSearch.filter(label => labels.includes(label.name));
    Logger.log("relevantLabels: " + relevantLabels.length)
    Logger.log(relevantLabels)
    for (const label of relevantLabels) {
        let adgroups = getAdGroupsForLabel(label.id);
        if (adgroups.length == 0) {
            Logger.log(`No adgroup with label ${label.name} found`);
            continue;
        }

        if (!products[label.name]) {
            Logger.log(`No entry in products for label: ${label.name}`);
            continue;
        }

        let cat_items = [...Object.values(products[label.name])].sort(function (a, b) {
            return b.sales - a.sales;
        });

        cat_items = cat_items.splice(0, 4)
        if(cat_items.length < 3) { continue; } // Continue if we do not have a least 3 items.
        const cat_arr = cat_items.map(i => `${i.title}|${i.description}|${i.price}|${i.url}`)
        const searchResults = AdsApp.search(`SELECT ad_group_asset.field_type,
                                                    ad_group_asset.asset,
                                                    ad_group.id,
                                                    asset.price_asset.price_offerings,
                                                    ad_group.labels,
                                                    asset.type,
                                                    asset.id
                                             FROM ad_group_asset
                                             WHERE asset.type = "PRICE"
                                               AND ad_group.id IN (${adgroups.join(", ")})
                                               AND ad_group_asset.primary_status != 'REMOVED'`)
        for (let row of searchResults) {
            Logger.log(row)
            let adgroup_id = row.adGroup.id
            let asset_id = row.asset.id
            let uniqueTitles = {}; // Objekt zur Verfolgung einzigartiger Titel
            const offerings = row.asset.priceAsset.priceOfferings
              .filter(offer => {
                  const title = offer.header;
                  if (uniqueTitles[title]) {
                      return false; // Überspringen Sie dieses Angebot, wenn der Titel bereits vorhanden ist
                  }
                  uniqueTitles[title] = true; // Markieren Sie den Titel als vorhanden
                  return true;
              })
              .map(i => `${i.header}|${i.description}|${costMicros(i.price.amountMicros)}|${i.finalUrl}`);
            //offerings
            //Logger.log(offerings)
            //Logger.log(cat_arr)
            //Logger.log(cat_arr.filter(i => offerings.indexOf(i) == -1).length)
            if (cat_arr.filter(i => offerings.indexOf(i) == -1).length == 0) adgroups = adgroups.filter(i => i != adgroup_id)
            let adgroupIterator = AdsApp.adGroups().withCondition(`ad_group.id="${adgroup_id}"`).get()
            if (!adgroupIterator.hasNext()) continue
            let adgroup = adgroupIterator.next()
            let priceIterator = AdsApp.extensions().prices().withCondition(`asset.id = ${asset_id}`).get()
            if (!priceIterator.hasNext()) continue
            let priceExtension = priceIterator.next()
            adgroup.removePrice(priceExtension)
        }
        if (adgroups.length == 0) continue
        //Logger.log('Here')
        //return
        let priceBuilder = AdsApp.extensions().newPriceBuilder();
        var priceOperation = priceBuilder
            .withPriceType(priceType)             // required
            .withLanguage(language)
        const priceItems = cat_items.map(i => createPriceItem(i)).map(i => (priceOperation.addPriceItem(i)))
        priceOperation = priceOperation.build()

        if (!priceOperation.isSuccessful()) Logger.log(priceOperation.getErrors())

        const price = priceOperation.getResult()
        for (let id of adgroups) {
            const adgroupIterator = AdsApp.adGroups().withCondition(`ad_group.id="${id}"`).get()
            if (!adgroupIterator.hasNext()) continue
            const adgroup = adgroupIterator.next()
            if(price) adgroup.addPrice(price)
        }
    }
}

function connectMerchant({merchant_id, stats, sh, sales_limit, field}) {
    let uniqueProducts = {}; // Zur Verfolgung eindeutiger Produkte
    const arr = [];
    let obj = {};
    sh.getDataRange().getDisplayValues().filter((v, i) => i != 0).map((v, i) => (obj[v[0]] = { index: i + 2, title: v[2], description: v[3] }));

    var pageToken;
    var pageNum = 1;
    var maxResults = 250;
    var products = {};

    do {
        var productList = ShoppingContent.Products.list(merchant_id, {
            pageToken: pageToken,
            maxResults: maxResults
        });

        if (productList.resources) {
            for (var i = 0; i < productList.resources.length; i++) {
                const product = productList.resources[i];
                if (product.productTypes == null || product.productTypes.length == 0) continue;

                const cat = product.productTypes[0].split(" > ").pop();
                const brand = product.brand || 'Unbranded'; // Fallback für Produkte ohne Marke

                let sh_item = obj[product.offerId.toString()];
                const sales = stats[product.offerId.toString()] || 0;
                if (!sh_item && sales >= sales_limit) {
                    arr.push([`'${product.offerId.toString()}`, product.title, product.title.length > 50 ? "" : product.title, ""]);
                }

                const title = sh_item?.title == null || sh_item?.title == "" ? product.title.substring(0, 25) : sh_item.title;
                if (title == "") continue;
                
                let description = "";
                if(product[field]){
                  description = product[field].substring(0, 25)
                } else if(cat){
                  description = cat.substring(0, 25)
                } else if(brand){
                  description = brand.substring(0, 25)
                } else {
                  description = title.substring(0, 25)
                }


                // Select the product with the lowest price for each unique title
                if (!uniqueProducts[title] || uniqueProducts[title].price > parseFloat(product.price.value.replace(/[^0-9.]/g, ''))) {
                    uniqueProducts[title] = {
                        id: product.offerId.toString(),
                        title,
                        description: description,
                        price: parseFloat(product.price.value.replace(/[^0-9.]/g, '')),
                        sales: stats[product.offerId.toString()] || 0,
                        url: product.link
                    };
                }

                // Convert uniqueProducts to the required format
                var products = {};
                for (const [title, product] of Object.entries(uniqueProducts)) {
                    // Erstellen von drei verschiedenen Label-Typen
                    const labels = [
                        `${brand} - ${cat}`, // brand + cat
                        `${brand}`,          // nur brand
                        `${cat}`             // nur cat
                    ];

                    labels.forEach(label => {
                        let labelProducts = products[label] || {};
                        labelProducts[product.id.toString()] = product;
                        products[label] = labelProducts;
                    });
                }
                
            }
        }
        pageToken = productList.nextPageToken;
        pageNum++;
    } while (pageToken);

    if (arr.length > 0) {
        const tmp = sh.getDataRange().getValues();
        sh.getRange(tmp.length + 1, 1, arr.length, arr[0].length).setValues(arr);
    }

    return products;
}



function getStats(days) {
    let result = {}
    const [start, end] = getDates(days)
    const searchResults = AdsApp.search(`SELECT segments.product_item_id, metrics.conversions
                                         FROM shopping_performance_view
                                         WHERE segments.date >= '${start}'
                                           AND segments.date <= '${end}'`)
    for (let row of searchResults) {
        if (row?.segments?.productItemId == null) continue
        //Logger.log(row)
        result[row.segments.productItemId] = parseFloat(row.metrics.conversions)
    }
    return result
}


function getDates(days) {
    const start = Utilities.formatDate(new Date(Date.now() - days * 86400000), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")
    const end = Utilities.formatDate(new Date(Date.now() - 1 * 86400000), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")
    return [start, end]
}

function costMicros(cost) {
    return parseInt(cost || 0) / 1000000
}

function get_label_id(Labelname) {
    const customerId = AdsApp.currentAccount().getCustomerId().replaceAll("-", "");
    const labelIterator = AdsApp.labels()
        .withCondition(`label.name = "${Labelname}"`)
        .get();
    if (labelIterator.hasNext()) {
        const label = labelIterator.next().getId();
        return `ad_group.labels CONTAINS ALL ('customers/${customerId}/labels/${label}') `;
    }
    return null;
}

function getAdGroups(label_query) {
    let result = []
    const searchResults = AdsApp.search(`SELECT ad_group.id
                                         FROM ad_group
                                         WHERE ${label_query}`)
    for (let {adGroup} of searchResults) {
        result.push(adGroup.id)
    }
    return result
}

function createPriceItem(obj) {
    var priceItemBuilder = AdsApp.extensions().newPriceItemBuilder();
    var priceItemOperation = priceItemBuilder
        .withHeader(obj.title.substring(0, 25))               // required
        .withDescription(obj.description.substring(0, 25))         // required
        .withAmount(obj.price)                            // required
        .withCurrencyCode(AdsApp.currentAccount().getCurrencyCode())//AdsApp.currentAccount().getCurrencyCode())                   // required
        .withUnitType("UNSPECIFIED")                  // required
        .withFinalUrl(obj.url)   // required
        .build();
    return priceItemOperation.getResult()

}

function loadAllLabels() {
    let labels = [];
    const labelIterator = AdsApp.labels().get();
    while (labelIterator.hasNext()) {
        const label = labelIterator.next();
        labels.push({id: label.getId(), name: label.getName()});
    }
    return labels;
}

function getAdGroupsForLabel(labelId) {
    let result = [];
    const customerId = AdsApp.currentAccount().getCustomerId().replaceAll("-", "");
    const searchResults = AdsApp.search(`SELECT ad_group.id
                                         FROM ad_group
                                         WHERE ad_group.labels CONTAINS ALL ('customers/${customerId}/labels/${labelId}')`);
    for (let {adGroup} of searchResults) {
        result.push(adGroup.id);
    }
    return result;
}
