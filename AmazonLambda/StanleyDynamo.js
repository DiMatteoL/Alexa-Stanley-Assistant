// This version is older than the RDS version

// Skill Code =======================================================================================================

var Alexa = require('alexa-sdk'); //for line 20 & 21
var AWS = require('aws-sdk');   // for AWS.DynamoDB.DocumentClient()
var AWSregion = 'us-east-1';  // us-east-1

AWS.config.update({
    region: AWSregion
});

var table = "Sales"; // Other tables can be create (Ex: in order to store previously made Queries if they become to big)

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);

    // alexa.appId = 'amzn1.echo-sdk-ams.app.1234';
    // alexa.dynamoDBTableName = 'YourTableName'; // creates new table for session.attributes

    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () { // "ex: Alexa, be Stanley"
        this.emit(':ask', 'Hello, I am Stanley, your assistant, ask me questions about your sales', 'Can you repeat?');
    },

    'MostPopularIntent' : function () { // "ex: Alexa, ask stanley about our best-selling product (last january)"

        var SalesDate = isSlotValid(this.event.request, "SalesDate"); // SalesDate is not required for BestCostumerIntent
        var param4;

        if (SalesDate){
            param4 = { // scanning part of the table, big cost
                    TableName: table,
                    FilterExpression : 'begins_with ( SaleDate, :hkey )',
                    ExpressionAttributeValues : {':hkey' : SalesDate}
            };
        }
        else {
            param4 = { // scanning the entire table, horrible cost, but I don't see any other way
                    TableName: table,
            };
        }

        scanDynamoItem(param4, myResult=>{ // Calling the scan function to extract the entire table. Very slow Query
            var say = '';

            var mf = 0;
            var m = 0;
            var item="";

            if(myResult.length>0){
                for (var i=0; i<myResult.length; i++)
                {
                    if(myResult[i].Product){
                        for (var j=i; j<myResult.length; j++)
                        {
                            //if (myResult[i].Product && myResult[j].Product){
                                if (myResult[i].Product == myResult[j].Product){
                                    m++;
                                }

                                if (mf<m)
                                {
                                  mf=m;
                                  item = myResult[i].Product;
                                }
                            //}
                        }
                        m=0;
                    }

                }
                if (SalesDate) say= "For "+ SalesDate + ", the " + item + " has been your best-seller with a total of : " + mf + " sales";
                else say= "the " + item + " has been your overall best-seller with a total of : " + mf + " sales";
            }
            else say= "I'm sorry to break it to you, but you can't have a best seller if you have no sales";

            this.emit(':tell', say);
        });



    },

    'BestCostumerIntent' : function () { // "ex: Alexa, ask stanley about my best costumer (in 2016)"

        var SalesDate = isSlotValid(this.event.request, "SalesDate"); // SalesDate is not required for BestCostumerIntent
        var param3;

        if (SalesDate){
            param3 = { // scanning part of the table, big cost
                    TableName: table,
                    FilterExpression : 'begins_with ( SaleDate, :hkey )',
                    ExpressionAttributeValues : {':hkey' : SalesDate}
                };
        }
        else {
            param3 = { // scanning the entire table, horrible cost, but I don't see any other way
                    TableName: table,
                };
        }
                scanDynamoItem(param3, myResult=>{ // Calling the scan function to extract the entire table. Very slow Query

                    var say = '';

                    var Name="";
                    var n=0;
                    var maxN=1;
                    var m=0;
                    var maxAmount=1;

                    if(myResult.length>0){
                        for (var i=0; i<myResult.length; i++)
                        {
                                for (var j=i; j<myResult.length; j++)
                                {
                                        if (myResult[i].Name == myResult[j].Name)
                                         m += myResult[j].Amount;
                                         n ++;
                                        if (maxAmount<m)
                                        {
                                          maxAmount=m;
                                          Name = myResult[i].Name;
                                        }
                                        if(maxN<n)  maxN=n;
                                }
                                console.log("MaxN :" + maxN);
                                m=0;
                                n=0;
                        }


                        if (SalesDate) say= "For "+ SalesDate + ", " + Name + " seems to be your best customer with a total spending of : " + maxAmount + " dollars";
                        else say= Name + " seems to be your overall best customer with a total spending of : " + maxAmount + " dollars";
                    }
                    else say= "you might want to sit for this one, you don't have a best customer, because you don't have any customers";

                    this.emit(':tell', say);
                });
    },

    'SalesIntent': function () { // "ex: Alexa, ask Stanley about yesterday's sales" | "ex: Alexa, ask Stanley about my sales last year"

        var filledSlots = delegateSlotCollection.call(this);

        var nNames=0; // Name count
        var isName=''; // Sentence with all the names
        var isAmount=0; // Sum of all the amounts

        Sale = new Array;

        var say = '';

        var SalesDate = this.event.request.intent.slots.SalesDate.value; // getting the date from Alexa



            if(SalesDate.length===10){ // If it is a day
                var param1 = { // Find the sales with that exact day in the database
                  TableName: table,
                  KeyConditionExpression: 'SaleDate = :hkey AND SaleID >= :rkey',
                  ExpressionAttributeValues: {
                    ':hkey': SalesDate,
                    ':rkey': 0
                  }
                };
                queryDynamoItem(param1, myResult=>{ //calling the query function to exctract only the exact right sales. Very fast Query
                    getSales(SalesDate, myResult, Sale, nNames, isName, isAmount, say, Emit=>{
                            this.emit(':tell', Emit);
                        });
                });
            }
            else { // if it is a month or a year
                var param2 = { // find the sales with a date starting by the month or year (ex: [[2017-07]]-09)
                    TableName: table,
                    FilterExpression : 'begins_with ( SaleDate, :hkey )',
                    ExpressionAttributeValues : {':hkey' : SalesDate}
                };
                scanDynamoItem(param2, myResult=>{ // Calling the scan function to extract the entire table to search for months and years. Very slow Query
                    getSales(SalesDate, myResult, Sale, nNames, isName, isAmount, say, Emit=>{
                        this.emit(':tell', Emit);
                    })
                })
            }
    },
    'AddSaleIntent': function () {
        var filledSlots = delegateSlotCollection.call(this);

        var Company = this.event.request.intent.slots.Company.value;
        var Product = this.event.request.intent.slots.Product.value;
        var Amount = this.event.request.intent.slots.Amount.value;
        var say = "Product : " + Product + ", Company : " + Company + ", Amount : " + Amount;
        this.emit(':tell', say);
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', "ask me any question about your sales");
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', 'Goodbye!');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'Goodbye!');
    }
};

//    END of Intent Handlers {} ========================================================================================
// Helper AWS Function  =================================================================================================


function queryDynamoItem(params, callback) {

    AWS.config.update({region: AWSregion});

    var docClient = new AWS.DynamoDB.DocumentClient();

    console.log('querying item from DynamoDB table ');

    docClient.query(params, (err, data) => {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));

            callback(data.Items);
        }
    });

}

function scanDynamoItem(params, callback) {

    AWS.config.update({region: AWSregion});

    var docClient = new AWS.DynamoDB.DocumentClient();

    console.log('scanning item from DynamoDB table');

    docClient.scan(params, (err, data) => {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2));

            callback(data.Items);
        }
    });

}

function delegateSlotCollection(){
  console.log("in delegateSlotCollection");
  console.log("current dialogState: "+this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
      var updatedIntent=this.event.request.intent;
      //optionally pre-fill slots: update the intent object with slot values for which
      //you have defaults, then return Dialog.Delegate with this updated intent
      // in the updatedIntent property
      this.emit(":delegate", updatedIntent);
    } /*else if (this.event.request.dialogState !== "COMPLETED") { //Makes the test bug, might be something to look at !
      console.log("in not completed");
      // return a Dialog.Delegate directive with no updatedIntent property.
      this.emit(":delegate");
    }*/ else {
      console.log("in completed");
      console.log("returning: "+ JSON.stringify(this.event.request.intent));
      // Dialog is now complete and all required slots should be filled,
      // so call your normal intent handler.
      return this.event.request.intent;
    }
}

function isSlotValid(request, slotName){ // use for a non-required slot
        var slot = request.intent.slots[slotName];
        //console.log("request = "+JSON.stringify(request));
        var slotValue;

        //if we have a slot, get the text and store it into speechOutput
        if (slot && slot.value) {
            //we have a value in the slot
            slotValue = slot.value.toLowerCase();
            return slotValue;
        } else {
            //we didn't get a value in the slot.
            return false;
        }
}

// Helper Non-AWS Functions ==============================================================

function getSales(SalesDate, myResult, Sale, nNames, isName, isAmount, say, callback) {
    if(myResult.length>0) {

                            for (var i = 0; i<myResult.length; i++) {
                                Sale[i] = {
                                  SaleId: myResult[i].SaleID,
                                  SaleDate: myResult[i].SaleDate
                                }
                                if (myResult[i].Name){ //If there is a name, destroy the doubles and create a sentence with it
                                    var unique=1; // Starts at 1 because the selected term will always be equal to himself
                                    Sale[i].Name = myResult[i].Name;
                                    for (var u =0; u < Sale.length ;u++){
                                        if (myResult[i].Name !== Sale[u].Name){
                                            unique+=1;
                                        }
                                    }
                                    if(unique===Sale.length){
                                        nNames += 1;
                                        if (i=== myResult.length-1 && i>0){
                                            isName += "and, " + Sale[i].Name + ", ";
                                        }
                                        else {
                                            isName+=Sale[i].Name + ", ";
                                        }
                                    }
                                }
                                if (myResult[i].Amount) { // If there is an amount, add it to the previous sum.
                                    Sale[i].Amount = myResult[i].Amount;
                                    isAmount += Sale[i].Amount;
                                }
                            }

                            if (isName && isAmount) { // If you end up by have names and an amount
                                if (nNames < 4) { // If you have less then 4 names, say them
                                  say = 'For ' +  SalesDate + ', I can count a total of ' + Sale.length + ' sales from : ' + isName + ' for a total amount of ' + isAmount + ' dollars.' ;
                                }
                                else { // If you have more then 4 names, say how many
                                  say = 'For ' +  SalesDate + ', I can count a total of ' + Sale.length + ' sales from ' + nNames + ' different companies, for a total amount of ' + isAmount + ' dollars.' ;
                                }

                            }
                            else { // If names or an amount doesn't exist
                                say= 'For ' +  SalesDate + ', I can count a total of ' + Sale.length + ' sales';
                            }
                    }
                    else { // If myResult is empty
                        say= 'For ' +  SalesDate + ', I can see no sales.';
                    }
                    callback(say);
}
