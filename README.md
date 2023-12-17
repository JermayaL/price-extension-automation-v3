# price-extension-automation-v3

**READ ME
**
1. Add the Google Ads script in a Single account.
2. Adjust the rows in this script:
&nbsp;
<ul>
<li>const merchant_id = {Merchant Centre ID</li>
<li>const days = {days historic performance}</li>
<li>const sheet_url = "https://docs.google.com/spreadsheets/d/1S5SDhNO1pouXvGprRAXnwqvVpzNmaGQjPDaUzPONxmQ/copy"</li>
<li>const priceType = "PRODUCT_CATEGORIES" //supported types 'BRANDS', 'EVENTS', 'LOCATIONS', 'NEIGHBORHOODS', 'PRODUCT_CATEGORIES', 'PRODUCT_TIERS', 'SERVICES', 'SERVICE_CATEGORIES', 'SERVICE_TIERS'</li>
<li>const language = "nl" // supported languages: de, en, es, es-419, fr, it, nl, pl, pt-BR, pt-PT, sv (check your country code)</li>
<li>const sales_limit = 1 // only bring product IDs with at least 1 sale.</li>
<li>const field = "customLabel0" // customLabel0, customLabel1, customLabel2, customLabel3, customLabel4</li>
</ul>

3. Save the script

4. Make a copy of the spreadsheet. Then go to _Extensions > Apps script_.
5. Make sure you have an OpenAI API-KEY. You can get this at: https://platform.openai.com/.
6. Add your own OpenAI API Key in row 11.
7. Replace line 16 with the text in your own language. but make sure the text remains the same: `Write a title for ads, with a limit of ${num} symbols with spaces`.
8. Save the script to the Apps script and run the script.
9. Then go back to the spreadsheet.

_In the spreadsheet, you will see in column D: description. Leave this blank if you are using your own product feed. You can use a custom label from the feed to populate it as description.
I personally use Channable and created a rule to grab a description from the tag of the product._
&nbsp;
![image](https://github.com/JermayaL/price-extension-automation-v3/assets/83117295/d4a1ee2d-c3b6-48f7-a2f4-5c286acc36bd)

_In Google Ads script, modify the rule if necessary. For example, if you use customlabel1 for this instead of customlabel0. It then takes the description from there._

Run Google Ads script. Make sure you have checked Advanced API: Shopping content.
Make sure the rows from the copy spreadsheet is empty. Only row 1 should remain. The merchant Title and ID will be retrieved.
You can now choose to use column D to add your own descriptions at the product ID level.
Otherwise, use the product feed rule and one of the custom columns to automatically complete the description in the price extension.

![image](https://github.com/JermayaL/price-extension-automation-v3/assets/83117295/b5db165d-e455-45ec-a3c7-0cc6b16f8cba)

The rows are completed in the spreadsheet. Go to the Google sheet. Run the Google Apps script:

![image](https://github.com/JermayaL/price-extension-automation-v3/assets/83117295/18f29284-fdbd-49ad-a6ee-07cc58944ab9)

Column C is completed with titles that are < 25 characters. Once filled, these columns are not overridden. So you will have to empty these first if you want to make something else out of them.
Once the titles are populated. Run the Google Ads script **AGAIN**.

That's it. Run the script daily. Your price extensions are automated this way. 
