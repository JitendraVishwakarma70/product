import puppeteer from "puppeteer";

const status = async (req, res)=>{
  try {
    res.status(200).json({message: `version 1.0`});
  } catch (error) {
    res.status(500).json({message: `Internal server error!`});
  }
}

const scrapData = async (req, res) => {
  try {
    const query = req.query.q;
    const category = req.query.cat;
    if(query && category){
      if(category === 'electronics' || category === 'clothes'){
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();

        await page.goto("https://www.amazon.in/");

        await page.type('input[id="twotabsearchtextbox"]', query);
        await page.keyboard.press("Enter");

        await page.waitForSelector('div[data-component-type="s-search-result"]');

        let allProducts = [];
        let hasNextPage = true;
        let maxRetries = 3;

        while (hasNextPage) {
          // Scrape the data on the current page
          const products = await page.evaluate((catnm) => {
            let productList = [];
            let items = document.querySelectorAll(
              'div[data-component-type="s-search-result"]'
            );

            items.forEach((item) => {
              let productImage = item?.querySelector('div[data-cy="image-container"] img.s-image')?.src || '';
              
              let productBrand = item?.querySelector("span.a-size-base-plus.a-color-base")?.innerText || item?.querySelector("span.a-size-medium.a-color-base.a-text-normal")?.innerText || "";
              
              let productSponsored = item?.querySelector('span.puis-label-popover-default')?.innerText || '';
              
              let productTitle =
                item?.querySelector("span.a-size-base-plus.a-color-base.a-text-normal")?.innerText || item?.querySelector("span.a-size-medium.a-color-base.a-text-normal")?.innerText || '';
              
              const productDetailsUrl = item?.querySelector('a.a-link-normal.s-no-outline')?.href || ''
              
              const productMonthlySale = item?.querySelector('div.a-row.a-size-base span.a-size-base.a-color-secondary')?.innerText.replace(/^M\.R\.P:\s*/, '') || '';
              
              productList.push({
                productTitle,
                productImage,
                productBrand,
                productSponsored,
                productMonthlySale,
                productDetailsUrl
              });
            });

            return productList;
          }, category);

          allProducts = allProducts.concat(products);

          // Check if the "Next" button is present
          const nextPageButton = await page.$(
            'a.s-pagination-next.s-pagination-button.s-pagination-separator'
          );

          if (nextPageButton) {
            let retries = 0;
            let pageMoved = false;

            while (retries < maxRetries && !pageMoved) {
              try {
                await Promise.all([
                  nextPageButton.click(),
                  page.waitForNavigation({ waitUntil: "networkidle2" }),
                ]);

                // Wait for the new page to load
                await page.waitForSelector('div[data-component-type="s-search-result"]', {timeout: 5000});
                pageMoved = true; // Successfully moved to the next page
              } catch (error) {
                retries++;
                console.error(`Retrying navigation to next page... (${retries}/${maxRetries})`);
              }
            }

            // If the page never moved after retries, stop the loop
            if (!pageMoved) {
              console.error("Failed to navigate to the next page.");
              hasNextPage = false;
            }
          } else {
            // No next button, end the loop
            hasNextPage = false;
          }
        }

        console.log(allProducts.length);
        if (allProducts.length) {
          res.status(200).json(allProducts);
        } else {
          res.status(201).json({ message: `Product not found!` });
        }

        await browser.close();
      }
      else {
        res.status(403).json({message: `Invalid category!`});
      }
    }
    else {
      res.status(403).json({message: `Missing query or category name!`});
    }
    
  } catch (error) {
    res.status(403).json({ message: error });
  }
};

const scrapDetail = async (req, res) => {
  try {
    const productUrl = req.query.url;
    const category = req.query.category;
    if(productUrl && category){
      if(!(category === 'electronics' || category === 'clothes')){
        res.status(403).json({message: `Invalid category!`})
      }
      else {
        const browser = await puppeteer.launch({headless : false});
        const page = await browser.newPage();
        await page.goto(productUrl);
        await page.waitForSelector('div#dp-container');
        const details = page.evaluate((catnm)=>{
          const element = document.querySelector('div#dp-container');
          let title = element?.querySelector('#productTitle')?.innerText || '';
          let availability = element?.querySelector('#availability span.a-size-medium.a-color-success')?.innerText || '';
          let discount = element?.querySelector('span.a-size-large.a-color-price.savingPriceOverride.aok-align-center.reinventPriceSavingsPercentageMargin.savingsPercentage')?.innerText || '';
          let delivery = element?.querySelector('span[data-csa-c-delivery-price="FREE"] span.a-text-bold')?.innerText || '';
          let price = element?.querySelector('span.a-price-whole')?.innerText || '';
          let originalPrice = element?.querySelectorAll('span.a-price.a-text-price span')[1]?.innerText || '';
          let status = element?.querySelector('#dealBadgeSupportingText span')?.innerText || '';
          let offerCollection = element?.querySelectorAll('div[data-a-expander-name="a2i-dpx-sopp-pc-atf-expander"] span.a-truncate-full.a-offscreen') || element?.querySelectorAll('li.a-carousel-card span[data-action="side-sheet"]');
          let offers = Array.from(offerCollection)?.map(ele=>{
            let title = ele?.querySelector('span.sopp-offer-title')?.innerText || ele?.querySelector('h6')?.innerText || "";
            let description = ele?.querySelector('span.description')?.innerText || ele?.querySelector('span.a-truncate-full a-offscreen')?.innerText || "";
            return { title, description};
          })
          let seller = element?.querySelector('div[tabular-attribute-name="Sold by"] span.a-size-small.tabular-buybox-text-message')?.innerText || '';
          let sellerProfile = element?.querySelector('div[tabular-attribute-name="Sold by"] span.a-size-small.tabular-buybox-text-message a')?.href || '';
          let rate = element?.querySelector('span[data-hook="rating-out-of-text"]')?.innerText || '';
          let reviewCount = element?.querySelector('span[data-hook="total-review-count"]')?.innerText || '';
          let userTotalReviews = element?.querySelectorAll('div[data-hook="review"]');
          let userReviews = Array.from(userTotalReviews).map(ele=>{
            let user_profile = ele.querySelector('a.a-profile div.a-profile-avatar img')?.src || '';
            let user_name = ele.querySelector('a.a-profile span.a-profile-name')?.innerText || '';
            let user_item_image = ele.querySelector('img[data-hook="review-image-tile"]')?.src || '';
            let user_rate = ele.querySelector('a[data-hook="review-title"] i[data-hook="review-star-rating"] span')?.innerText || '';
            let user_rate_msg = ele.querySelectorAll('a[data-hook="review-title"] span')[2]?.innerText || '';
            let user_review_date = ele.querySelector('span[data-hook="review-date"]')?.innerText || '';
            let user_review_message = ele.querySelector('span[data-hook="review-body"] div[data-hook="review-collapsed"] span')?.innerText || '';
            return { user_profile, user_name, user_item_image, user_rate, user_rate_msg, user_review_date, user_review_message }
          })
          let brand = element?.querySelector('#bylineInfo')?.innerText || '';
          let sizeValue = element?.querySelector('select[data-action="a-dropdown-select"]')?.value || '';
          let size = element?.querySelector(`option[value="${sizeValue}"]`)?.innerText.replace(/\s+/g, '') || '';
          let sizes = element?.querySelectorAll('select[data-action="a-dropdown-select"] option') || [];
          let allSizes = Array.from(sizes).map(ele=> ({size : ele.innerText.replace(/\s+/g, '')}) ).filter(ele=>ele.size.toLowerCase() !== 'select') || [];

          let uniqueInfoKey = element?.querySelector('label.a-form-label')?.innerText || "";
          let uniqueInfoValue = element?.querySelector('span.selection')?.innerText || "";
          let rows1 = element?.querySelectorAll('table.a-normal.a-spacing-micro tr')
          let rows2 = element?.querySelectorAll('div.a-fixed-left-grid.product-facts-detail div.a-fixed-left-grid-inner');
          let rows = (rows1.length ? rows1 : rows2)
          let allDetails = Array.from(rows)?.map(ele=>{
            let type = ele.querySelector('td.a-span3 span')?.innerText || ele.querySelector('div.a-col-left span.a-color-base')?.innerText || "";
            let value = ele.querySelector('td.a-span9 span')?.innerText || ele.querySelector('div.a-col-right span.a-color-base')?.innerText || "";
            return { type, value }
          });
          let featureCollection1 = element?.querySelectorAll('#feature-bullets ul li span');
          let featureCollection2 = element?.querySelectorAll('ul span li span.a-list-item');
          let featureCollection = (featureCollection1.length ? featureCollection1 : featureCollection2);
          let features = Array.from(featureCollection)?.map(ele=>{
            let feature = ele?.innerText.replace(/^\d{1,2}\.\s/gm, '') || "";
            return feature;
          })

          // let itemDetails = element?.querySelectorAll('div.a-fixed-left-grid-inner');
          // let fastDelivery = element?.querySelector('span[data-csa-c-delivery-price="fastest"] span.a-text-bold')?.innerText;
          // let info = element?.querySelectorAll('div.a-fixed-left-grid.product-facts-detail div.a-fixed-left-grid-inner');
          // let otherInfo = element?.querySelectorAll('ul.a-unordered-list.a-vertical.a-spacing-small');
          // let additionalInfo = Array.from(info).map(ele=>{
          //     let type = ele.querySelector('div.a-col-left span.a-color-base')?.innerText;
          //     let value = ele.querySelector('div.a-col-right span.a-color-base')?.innerText;
          //     return { type, value }
          // })
          // let mergeMe = Array.from(otherInfo).map(ele=>{
          //     let type = ele.querySelector('span.a-list-item.a-size-base.a-color-base')?.innerText;
          //     let values = type.split(':');
          //     return { type: values[0], value: values[1]}
          // })
          // let details = Array.from(itemDetails).map(item=>{
          //     let type = item.querySelector('div.a-col-left span')?.innerText.replace(/\s+/g, '');
          //     let value = item.querySelector('div.a-col-right span')?.innerText.replace(/\s+/g, '');
          //     if(type && value){
          //         return { type, value}
          //     }
          // }).filter(ele=>ele)

          if(catnm === 'electronics'){
            return { name:title, availability, brand, currentStatus: status, uniqueInfo: { [uniqueInfoKey] : uniqueInfoValue}, price, originalPrice, discount, delivery, details: allDetails, features, offers, rating:rate, reviewCount, seller, sellerProfile, userReviews };
          }
          else {
            return { availability, brand, uniqueInfo: { [uniqueInfoKey] : uniqueInfoValue}, price, originalPrice, discount, delivery, details: allDetails, features, offers, currentStatus: status, name:title, size, sizes:allSizes, rating:rate, reviewCount, seller, sellerProfile, userReviews };
          }
        }, category)
        const data = await details;
        res.status(200).json(data);
        await browser.close();
      }
    }
    else {
      res.status(403).json({message: `Missing queries!`})
    }
  } catch (error) {
    res.status(400).json({message : error})
  }
}

export { status, scrapData, scrapDetail };
