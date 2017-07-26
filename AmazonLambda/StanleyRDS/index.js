// Skill Code =======================================================================================================

var Alexa = require('alexa-sdk'); //for line 20 & 21
var AWS = require('aws-sdk');   // for AWS.DynamoDB.DocumentClient()
const pg = require('pg');

var config = {
  user: 'wcs_conf', //env var: PGUSER
  database: 'StanleyPostgreSQL', //env var: PGDATABASE
  password: 'stanleyassistant', //env var: PGPASSWORD
  host: 'stanleypostgresql.ciehsqjm8kpc.us-east-1.rds.amazonaws.com', // Server hosting the postgres database
  port: 5432, //env var: PGPORT
  max: 10, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);

    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () { // "ex: Alexa, be Stanley"
        this.emit(':ask', 'Hello, I am Stanley, your assistant, what can I do for you today?', 'Can you repeat?');
    },

    'MostPopularIntent' : function () { // "ex: Alexa, ask stanley about our best-selling product (last january)"

        var SalesDate = isSlotValid(this.event.request, "SalesDate"); // SalesDate is not required for BestCostumerIntent

        if (!SalesDate){
            SalesDate="2";
        };

                queryRDSItems(config, SalesDate, myResult=>{ // Calling the scan function to extract the entire table. Very slow Query
            var say = '';

            var mf = 0;
            var m = 0;
            var item="";

            if(myResult.length>0){
                for (var i=0; i<myResult.length; i++)
                {
                    if(myResult[i].product){
                        for (var j=i; j<myResult.length; j++)
                        {
                            //if (myResult[i].product && myResult[j].product){
                                if (myResult[i].product == myResult[j].product){
                                    m++;
                                }

                                if (mf<m)
                                {
                                  mf=m;
                                  item = myResult[i].product;
                                }
                            //}
                        }
                        m=0;
                    }

                }
                if (SalesDate.length>3) say= "For "+ SalesDate + ", the " + item + " has been your best-seller with a total of : " + mf + " sales";
                else say= "the " + item + " has been your overall best-seller with a total of : " + mf + " sales";
            }
            else say= "I'm sorry to break it to you, but for " + SalesDate + ", you can't have a best seller if you have no sales";

            this.emit(':tell', say);
        });



    },

    'BestCostumerIntent' : function () { // "ex: Alexa, ask stanley about my best costumer (in 2016)"

        var SalesDate = isSlotValid(this.event.request, "SalesDate"); // SalesDate is not required for BestCostumerIntent

        if (!SalesDate){
            SalesDate="2";
        };
                queryRDSItems(config, SalesDate, myResult=>{ // Calling the scan function to extract the entire table. Very slow Query

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
                                        if (myResult[i].company == myResult[j].company)
                                         m += myResult[j].amount;
                                         n ++;
                                        if (maxAmount<m)
                                        {
                                          maxAmount=m;
                                          Name = myResult[i].company;
                                        }
                                        if(maxN<n)  maxN=n;
                                }
                                m=0;
                                n=0;
                        }


                        if (SalesDate.length>3) say= "For "+ SalesDate + ", " + Name + " seems to be your best customer with a total spending of : " + maxAmount + " dollars";
                        else say= Name + " seems to be your overall best customer with a total spending of : " + maxAmount + " dollars";
                    }
                    else say= "For " + SalesDate + ". You don't have a best customer, because you don't have any customers";

                    this.emit(':tell', say);
                });
    },

    'SalesIntent': function () { // "ex: Alexa, ask Stanley about yesterday's sales" | "ex: Alexa, ask Stanley about my sales last year"



        var isName=''; // Sentence with all the names
        var isAmount=0; // Sum of all the amounts
        var nTotal=0;

        var say = '';

        var SalesDate = this.event.request.intent.slots.SalesDate.value; // getting the date from Alexa

        if(!SalesDate) var filledSlots = delegateSlotCollection.call(this);

                queryDinstinctRDSItems(config, SalesDate, myResult=>{ // Calling the scan function to extract the entire table to search for months and years. Very slow Query
                    getSales(SalesDate, myResult, nTotal, isName, isAmount, say, Emit=>{
                        this.emit(':tell', Emit);
                    })
                })

    },
    'AddSaleIntent': function () {
        var filledSlots = delegateSlotCollection.call(this);
        var say = "";
        var Company = this.event.request.intent.slots.Company.value;
        var Product = this.event.request.intent.slots.Product.value;
        var Amount = this.event.request.intent.slots.Amount.value;

        if(this.event.request.intent.confirmationStatus==="CONFIRMED"){
              addRDSItems(config, Company, Product, Amount, Call => {

              say = "The sale has been submitted to the database.";
              this.emit(':tell', say);
          });
        }else this.emit(':tell',"The sale has been erased.");



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


function queryRDSItems(config, date, callback) {
  date +="%";
  var pool = new pg.Pool(config);
      pool.on('error', function (err, client) {
        console.error('idle client error', err.message, err.stack);
      });
      pool.connect(function (err,client,done) {
        if (err) throw err;
        client.query('SELECT * FROM public.sales WHERE sales.saledate::text LIKE $1',[date], function(err,result) {
          if (err) throw err;
          callback(result.rows);
    });
  });
}

function queryDinstinctRDSItems(config, date, callback){
  date +="%";
  var pool = new pg.Pool(config);
      pool.on('error', function (err, client) {
        console.error('idle client error', err.message, err.stack);
      });
      pool.connect(function (err,client,done) {
        if (err) throw err;
        client.query('SELECT count(*), SUM(amount), company FROM public.sales WHERE saledate::text LIKE $1 GROUP BY company',[date], function(err,result) {
          if (err) throw err;
          callback(result.rows);
    });
  });
  ;
};

function addRDSItems(config, _company, _product, _amount, callback) {
        var _date = new Date();

        var dd = _date.getDate();
        var mm = _date.getMonth()+1; //January is 0!
        var yyyy = _date.getFullYear();

        if(dd<10) {
            dd = '0'+dd
        }

        if(mm<10) {
            mm = '0'+mm
        }

        _date = yyyy + "-" + mm + "-" + dd;
        var pool = new pg.Pool(config);
            pool.connect(function (err,client,done) {
              client.query('INSERT INTO public.sales ("saledate", "company", "product", "amount") VALUES ($1,$2,$3,$4)',[_date,_company,_product,_amount]);
              callback();
        });

};

function delegateSlotCollection(){
  console.log("in delegateSlotCollection");
  console.log("current dialogState: "+this.event.request.dialogState);
    if (this.event.request.dialogState === "STARTED") {
      var updatedIntent=this.event.request.intent;
      //optionally pre-fill slots: update the intent object with slot values for which
      //you have defaults, then return Dialog.Delegate with this updated intent
      // in the updatedIntent property
      this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") { // !!!!!!!!!!!! COMMENT THE ELSE IF  IF YOU WANT TO TEST THE CODE WITH LAMBDA!!!!!!!!!!!!!!!!!!!
      console.log("in not completed, yet");
      // return a Dialog.Delegate directive with no updatedIntent property.
      this.emit(":delegate");
    } else {
      console.log("in completed");
      console.log("returning: "+ JSON.stringify(this.event.request.intent));
      // Dialog is now complete and all required slots should be filled,
      // so call your normal intent handler.
      return this.event.request.intent;
    }
}

function isSlotValid(request, slotname){ // use for a non-required slot
        var slot = request.intent.slots[slotname];
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

function getSales(SalesDate, myResult, nTotal, isName, isAmount, say, callback) {
    if(myResult.length>0) {
                            for (var i = 0; i<myResult.length; i++){

                              if(i!= myResult.length-1) isName+=myResult[i].company + ", ";
                              else isName += "and, " + myResult[i].company + ", ";

                              isAmount+= myResult[i].sum;

                              nTotal += parseInt(myResult[i].count.toString());
                            }


                            // This was used with the dynamodb version, because it doesn't allows SQL request, so I had to do it manually.
                            /*for (var i = 0; i<myResult.length; i++) {
                                Sale[i] = {
                                  SaleId: myResult[i].saleid,
                                  SaleDate: myResult[i].saledate
                                }
                                if (myResult[i].company){ //If there is a company name, destroy the doubles and create a sentence with it
                                    var unique=1; // Starts at 1 because the selected term will always be equal to himself
                                    Sale[i].company = myResult[i].company;
                                    for (var u =0; u < Sale.length ;u++){
                                        if (myResult[i].company !== Sale[u].company){
                                            unique+=1;
                                        }
                                    }
                                    if(unique===Sale.length){
                                        nNames += 1;
                                        if (i=== myResult.length-1 && i>0){
                                            isName += "and, " + Sale[i].company + ", ";
                                        }
                                        else {
                                            isName+=Sale[i].company + ", ";
                                        }
                                    }
                                }
                                if (myResult[i].amount) { // If there is an amount, add it to the previous sum.
                                    Sale[i].amount = myResult[i].amount;
                                    isAmount += Sale[i].amount;
                                }
                            }*/

                            if (isName && isAmount) { // If you end up by have names and an amount
                                if (myResult.length < 5) { // If you have less then 4 names, say them
                                  say = 'For ' +  SalesDate + ', I can count a total of ' + nTotal + ' sales from : ' + isName + ' for a total amount of ' + isAmount + ' dollars.' ;
                                }
                                else { // If you have more then 4 names, say how many
                                  say = 'For ' +  SalesDate + ', I can count a total of ' + nTotal + ' sales from ' + myResult.length + ' different companies, for a total amount of ' + isAmount + ' dollars.' ;
                                }

                            }
                            else { // If names or an amount doesn't exist
                                say= 'For ' +  SalesDate + ', I can count a total of ' + nTotal + ' sales';
                            }
                    }
                    else { // If myResult is empty
                        say= " For " + SalesDate + ", you don't have any sales, but keep it up, I'm sure it will come.";
                    }
                    callback(say);
}
