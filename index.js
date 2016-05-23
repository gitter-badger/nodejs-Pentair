var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var sp = new SerialPort("/dev/ttyUSB0", {
    baudrate: 9600,
    databits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    parser: serialport.parsers.raw
});

var data2; //variable to hold all serialport.open data; appends to this with each read
var loglevel = 0; //1=more, 0=less
var currentStatus; // persistent variable to hold pool equipment status.
var instruction; //var to hold potential chatter instructions


const state = {
    OFF: 0,
    ON: 1,
}

const stateStr = {
    'off': state.OFF,
    'on': state.ON
}

const strState = {
    0: "Off",
    1: "On"
}

// offset from start of packet info
// this packet definition is only good if heat command on pool is one of Heater/Solar Pref/Solar Only (off is different)
const packetFields = {
    DEST: 0,
    FROM: 1,
    ACTION: 2,
    DATASIZE: 3,
    HOUR: 4,
    MIN: 5,
    EQUIP1: 6,
    EQUIP2: 7,
    EQUIP3: 8,
    WATER_TEMP: 18,
    AIR_TEMP: 22
}

const pumpPacketFields = {
    POWER: 4,
    WATTS: 7,
    RPM: 9
}

const ctrl = {
    BROADCAST: 15,
    MAIN: 16,
    REMOTE: 32,
    WIRELESS: 34, //GUESS
    PUMP1: 96,
    PUMP2: 97
}

const ctrlString = {
    15: 'Broadcast',
    16: 'Main',
    32: 'Remote',
    34: 'Wireless', //GUESS
    96: 'Pump1',
    97: 'Pump2'
}





var configurationFile = 'config.json';
fs = require('fs');
var poolConfig = JSON.parse(fs.readFileSync(configurationFile));


//-----array format
var j = 0;
var circuitArr = [
    [], //Circuits 0-7
    [], //Circuits 8-15
    [] //Circuits 16-?
];

for (var key in poolConfig.Pentair) {
    if (poolConfig.Pentair.hasOwnProperty(key)) {
        if (j < 8) {
            myEQ = 0; //8 bits for first mode byte
        } else if (j >= 8 && j < 16) {
            (myEQ = 1) //8 bits for 2nd mode byte
        } else(myEQ = 2); //8 bits for 3rd mode byte
        circuitArr[myEQ].push(poolConfig.Pentair[key]);
        j++;
    }
}

//Used to count all items in array 
//countObjects(circuitArr) will count all items provided in config.json
function countObjects(obj) {
    var count = 0;
    // iterate over properties, increment if a non-prototype property
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            for (var key2 in obj[key]) {
                if (obj[key].hasOwnProperty(key2))
                    count++
            }
    }
    return count;
}

var equipmentCount = countObjects(circuitArr)
if (loglevel) {
    console.log('total # equipment: ', equipmentCount) //17
    console.log('equipLen: ', circuitArr.length, '0 array: ', circuitArr[0].length) //3, 8
}








sp.on('open', function () {
    console.log('open');
    sp.on('data', function (data) {
        //console.log('data received: ', JSON.stringify(data.toJSON()));

        if (typeof data2 === "undefined") {
            data2 = data;
            if (loglevel) {
                console.log('assigning data2=data');
            }
        } else {
            data2 = Buffer.concat([data2, data]);
        }


        //start to parse message at 250 bytes.  Is there a better time or way to know when the buffer has a full message or to start processing?
        if (data2.length > 250) {

            var chatter; //a {potential} message we have found on the bus
            var b = data2.toJSON();


            if (loglevel) {
                var temp = 'Data2 (or b): '
                for (x = 0; x <= b.data.length - 1; x++) {
                    temp += ', (' + x + ')' + b.data[x];
                }
                console.log(temp);
            }


            var i = 0;
            //-20 because chatter is possibly in the end/incomplete in the buffer
            for (i; i <= data2.length - 20; i++) {
                if (b.data[i] == 0) {
                    continue;
                } else {
                    //look for Pentair preamble 255,0,255,165
                    if (b.data[i] == 255 && b.data[i + 1] == 0 && b.data[i + 2] == 255 && b.data[i + 3] == 165) {
                        var chatterlen = b.data[i + 8] + 6 + 2; //chatterlen is length of following message not including checksum (need to add 6 for start of chatter (165,07,Dest,Src,02,chatterlen) and 2 for checksum)
                        i += 3; //jump ahead to start of payload

                        //if we don't have the length bit in the buffer or the length of the message is less than the remaining buffer bytes
                        if (chatterlen == undefined || (data2.length - i - chatterlen) < 0) {
                            //reset the buffer starting with the current partial message
                            if (loglevel) console.log('Message at end of buffer.  Prepending message to empty buffer string.');

                            //I THINK THIS IS CAUSING PROBLEMS.
                            //data2.copy(dataTemp, 0, i, chatterlen);
                            var copy = new Buffer(data2);
                            //var copy = new Buffer(JSON.parse(JSON.stringify(data2)));
                            data2 = null;
                            data2 = new Buffer(['0']);
                            //data2 = new Buffer(copy);
                            break;
                        }
                        if (loglevel) {
                            console.log('length should be: ' + chatterlen + ' at: ' + i)
                        }

                        //iterate through the JSON array to pull out a valid message
                        for (j = 0; j <= chatterlen; j++) {
                            if (j == 0) {
                                var output = "     Found chatter (text): " //for logging, remove later
                                chatter = new Array(chatterlen);
                            }
                            output += b.data[i + j];
                            output += " ";

                            chatter[j] = b.data[i + j];
                            if (j == chatterlen - 1) {
                                //console.log(output + '\n');
                                checksum(chatter, decode);
                                //skip ahead in the buffer for loop to the end of this message. 
                                i = j + i;
                            }
                        }

                    } else {
                        //no matching 255,0,255,165
                        continue;
                    }

                    //if we reach the 6th to last item in the buffer, the buffer is too short to contain any message.  Reinitialize a new buffer with the remaining bytes.
                    if (i == (data2.length - 20)) {
                        //preallocate a new buffer to 2500 bytes with the existing data
                        console.log('REACHED END OF BUFFER, RESETTING');

                        data2 = data2.slice(i);  

                        break;
                    }
                }


            }
        };
    });

});



/*
Somehow the checksum function is being called twice with the splice(0,2) resulting in parsed messages like: 
Shifted message  [ 'Action: 2',
  29,
  16,
  33,
...
  4,
  47,
  255,
  0 ]

Not sure why this is happeneng.  Need to debug.
*/

//Validate the checksum on the chatter
function checksum(chatterdata, callback) {
    len = chatterdata.length;
    if (loglevel) {
        console.log(' in checksum ; length: ', len);
    }
    //checksum is calculated by 256*2nd to last bit + last bit 
    var chatterdatachecksum = (chatterdata[len - 2] * 256) + chatterdata[len - 1];
    databytes = 0;

    // add up the data in the payload
    for (i = 0; i < len - 2; i++) {
        databytes += chatterdata[i];
    }

    validChatter = (chatterdatachecksum == databytes);
    if (loglevel) {
        console.log('chatterdatachecksum: ', chatterdatachecksum, '(should be ', chatterdata[len - 2], ' times 256 + ', chatterdata[len - 1]);
        console.log('databytes: ' + databytes);
        console.log('therefore chatterdatachecksum==databytes? ' + (chatterdatachecksum == databytes) ? "TRUE!" : "no");
    }

    //now that we calculated checksum, strip leading 165 and 10 as it is extraneous
    chatterdata.splice(0, 2);

    if (loglevel) {
        console.log('Shifted message ', chatterdata);
    }


    //call new function to process message
    if (validChatter) callback(chatterdata);
};

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
}

function decode(data) {
    //this payload is good if heat command on pool is one of Heater/Solar Pref/Solar Only
    if (data.length == 35 && data[packetFields.FROM] == ctrl.MAIN && data[packetFields.DEST] == ctrl.BROADCAST) {

        //status will be our return object
        var status = {};
        //time returned in HH:MM (24 hour)
        status.time = data[packetFields.HOUR] + ':' + data[packetFields.MIN];
        //Loop through the three bits that start at 3rd (and 4th/5th) bit in the data payload
        for (i = 0; i < circuitArr.length; i++) {
            //loop through all physical circuits within each of the bits
            for (j = 0; j < circuitArr[i].length; j++) {
                tempFeature = circuitArr[i][j]; //name of circuit
                equip = data[packetFields.EQUIP1 + i]
                status[tempFeature] = (equip & (1 << (j))) >> j ? "on" : "off"
            }
        }

        //Check if we have the same data
        //This should also significantly limit the amount of duplicate broadcast/chatter.  At a minimum, the packet should be different every minute.  If it is more than that, we need to explore further.
        if (currentStatus == null || currentStatus == undefined) {
            currentStatus = status;
            console.log('-->EQUIPMENT \n Equipment Status: ', status, '\n <-- EQUIPMENT \n')
        }
        if (data.length == 35 && !status.equals(currentStatus)) {



            //It seems that sometimes the time flutters between slight variations (minutes)
            //while debugging, display the full packet when there is a change so we can inspect
            statusTmp = status;
            //let's copy the time and recheck if the objects are equal
            statusTmp.time = currentStatus.time;
            if (statusTmp.equals(currentStatus)) {
                //ignore the time difference is everything else is the same
                console.log('--> Broadcast   Ignoring time difference because everything else is the same <-- Broadcast ')
            } else {
                //something besides the time is different

                console.log('-->EQUIPMENT \n Equipment Status: ', status, '\n <-- EQUIPMENT \n')  //Short, clean version


                if (loglevel) console.log('-->EQUIPMENT \n Equipment Status verbose: ', JSON.stringify(status), '\n', parseChatter(data), '\nStatus: ', status, '\nLength: ', data.length, '\n <-- EQUIPMENT \n');
                console.log('What\'s Different (first occurrence only?: ', status.whatsDifferent(currentStatus))
                currentStatus = status;
            }

        } else if (!status.equals(currentStatus)) {


            console.log('-->VARIATION\n Equipment Status verbose: ', JSON.stringify(status), '\n', parseChatter(data), '\nStatus: ', status, '\nLength: ', data.length, '\n <-- VARIATION \n');

        }



        // if the time field is whacked, don't send any data.  
        d = status.time.split(":")
        if (parseInt(d[0]) < 24 && parseInt(d[1]) < 60) {
            if (loglevel) console.log('-->EQUIPMENT \n Equipment Status verbose: ', JSON.stringify(status), '\n', parseChatter(data), '\n <-- EQUIPMENT \n');
        }

    }
    // Pump packet
    // Need to get addresses for 2 pumps!
    else if ((data[packetFields.FROM] == ctrl.PUMP1 || data[packetFields.FROM] == ctrl.PUMP2) && data[packetFields.DEST] == ctrl.MAIN && data[packetFields.ACTION] == 7) {
        var status = {
            pump: null,
            power: null,
            watts: null,
            rpm: null
        }

        var pumpnum = (data[packetFields.FROM]).toString();
        status.pump = ctrlString[pumpnum];
        status.watts = (data[pumpPacketFields.WATTS] * 256) + data[pumpPacketFields.WATTS + 1]
        status.rpm = (data[pumpPacketFields.RPM] * 256) + data[pumpPacketFields.RPM + 1]
        if (data[pumpPacketFields.POWER] == 10) {
            status.power = 1
        } else {
            status.power = 0
        }
        console.log('--> PUMP ', ctrlString[pumpnum], '\n Pump Status: ', JSON.stringify(status), '\n', 'Full Payload: ', JSON.stringify(data), '\n<-- PUMP ', ctrlString[pumpnum], '\n');
        //eventEmitter.emit('pumpStatus', status);
    }
    //message not decodede
    if (typeof status == 'undefined') {
        
        if (instruction == null || instruction == undefined) {
            instruction = data;
        } else
            

        //is status a response to the instruction?
        if (data.isResponse(instruction)) {
            console.log('Chatter %s is acknowledgement to instruction %s: ', JSON.stringify(data), JSON.stringify(instruction))
        } else{
            console.log('Unknown chatter: ', JSON.stringify(data))
            instruction = data.slice();
        }

    }
    return true; //fix this; turn into callback(?)
}

//This function just for visual/log usage.
function parseChatter(parsedata) {
    console.log(JSON.stringify(parsedata));
    len = parsedata.length;

    if (len == 35) { //Broadcast packet
        if (loglevel) {
            _equip1 = parsedata[packetFields.EQUIP1]
            _equip2 = parsedata[packetFields.EQUIP2]
            _equip3 = parsedata[packetFields.EQUIP3]
            console.log('Equip 1')
            console.log('circuit1 (Spa)    : ', _equip1 & 1)
            console.log('bit2 (Jets)       : ', (_equip1 & 2) >> 1)
            console.log('bit3 (Air Blower ): ', (_equip1 & 4) >> 2)
            console.log('bit4 (Cleaner)    : ', (_equip1 & 8) >> 3)
            console.log('bit5 (WtrFall1.5) : ', (_equip1 & 16) >> 4)
            console.log('bit6 (Pool)       : ', (_equip1 & 32) >> 5)
            console.log('bit7 (Spa Lights?): ', (_equip1 & 64) >> 6)
            console.log('bit8 (Pool Lights): ', (_equip1 & 128) >> 7)
            console.log('Equip2')
            console.log('bit1 (Path Lights): ', _equip2 & 1)
            console.log('bit2 (?)          : ', (_equip2 & 2) >> 1)
            console.log('bit3 (Spillway)   : ', (_equip2 & 4) >> 2)
            console.log('bit4 (WtrFall 1 ) : ', (_equip2 & 8) >> 3)
            console.log('bit5 (WtrFall 2 ) : ', (_equip2 & 16) >> 4)
            console.log('bit6 (WtrFall 3 ) : ', (_equip2 & 32) >> 5)
            console.log('bit7 (Pool low)   : ', (_equip2 & 64) >> 6)
            console.log('bit8 (Feature 6)  : ', (_equip2 & 128) >> 7)
            console.log('Equip3')
            console.log('bit 1 (Feature 7)', _equip3 & 1)
            console.log('bit 2 (Feature 8)', (_equip3 & 2) >> 1)
        }

        parsedata[packetFields.FROM] = 'Src: ' + parsedata[packetFields.FROM];
        parsedata[packetFields.DEST] = 'Dest: ' + parsedata[packetFields.DEST];
        parsedata[packetFields.ACTION] = 'Action: ' + parsedata[packetFields.ACTION];
        parsedata[packetFields.DATASIZE] = 'Len: ' + parsedata[packetFields.DATASIZE];
        parsedata[packetFields.HOUR] = 'Hr: ' + parsedata[packetFields.HOUR];
        parsedata[packetFields.MIN] = 'Min: ' + parsedata[packetFields.MIN];
        parsedata[packetFields.EQUIP1] = 'MODE1: ' + parsedata[packetFields.EQUIP1];
        parsedata[packetFields.EQUIP2] = 'MODE2: ' + parsedata[packetFields.EQUIP2];
        parsedata[packetFields.EQUIP3] = 'MODE3: ' + parsedata[packetFields.EQUIP3];
        parsedata[packetFields.WATER_TEMP] = 'WtrTemp: ' + parsedata[packetFields.WATER_TEMP];
        parsedata[packetFields.AIR_TEMP] = 'AirTemp: ' + parsedata[packetFields.AIR_TEMP];
        parsedata[len - 1] = 'ChkH: ' + parsedata[len - 1];
        parsedata[len - 2] = 'ChkL: ' + parsedata[len - 2];
        return (JSON.stringify(parsedata) + ' & Length: ', len);
    } else if (len == 7) //Pump actions?
    {
        returnStr = 'Unknown chatter of length: %s to Dest: %s from %S ', len, ctrlString[parsedata[packetFields.DEST]], ctrlString[parsedata[packetFields.SRC]];
        parsedata[packetFields.DEST] = 'Dest: ' + parsedata[packetFields.DEST];
        parsedata[packetFields.FROM] = 'Src: ' + parsedata[packetFields.FROM];
        return (returnStr + 'Pump Instructions? \n', JSON.stringify(parsedata) + ' & Length: ', len);
    }
}




Object.prototype.equals = function (object2) {
    //For the first loop, we only check for types
    for (propName in this) {
        //Check for inherited methods and properties - like .equals itself
        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty
        //Return false if the return value is different
        if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
            return false;
        }
        //Check instance type
        else if (typeof this[propName] != typeof object2[propName]) {
            //Different types => not equal
            return false;
        }
    }
    //Now a deeper check using other objects property names
    for (propName in object2) {
        //We must check instances anyway, there may be a property that only exists in object2
        //I wonder, if remembering the checked values from the first loop would be faster or not 
        if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
            return false;
        } else if (typeof this[propName] != typeof object2[propName]) {
            return false;
        }
        //If the property is inherited, do not check any more (it must be equa if both objects inherit it)
        if (!this.hasOwnProperty(propName))
            continue;

        //Now the detail check and recursion

        //This returns the script back to the array comparing
        /**REQUIRES Array.equals**/
        if (this[propName] instanceof Array && object2[propName] instanceof Array) {
            // recurse into the nested arrays
            if (!this[propName].equals(object2[propName]))
                return false;
        } else if (this[propName] instanceof Object && object2[propName] instanceof Object) {
            // recurse into another objects
            //console.log("Recursing to compare ", this[propName],"with",object2[propName], " both named \""+propName+"\"");
            if (!this[propName].equals(object2[propName]))
                return false;
        }
        //Normal value comparison for strings and numbers
        else if (this[propName] != object2[propName]) {
            return false;
        }
    }
    //If everything passed, let's say YES
    return true;
}

Object.prototype.whatsDifferent = function (object2) {
    //For the first loop, we only check for types
    for (propName in this) {
        //Check for inherited methods and properties - like .equals itself
        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty
        //Return false if the return value is different
        if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
            return this.hasOwnProperty(propName);
        }
        //Check instance type
        else if (typeof this[propName] != typeof object2[propName]) {
            //Different types => not equal
            return 'Object type';
        }
    }
    //Now a deeper check using other objects property names
    for (propName in object2) {
        //We must check instances anyway, there may be a property that only exists in object2
        //I wonder, if remembering the checked values from the first loop would be faster or not 
        if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
            return this.hasOwnProperty(propName);
        } else if (typeof this[propName] != typeof object2[propName]) {
            return 'Object type';
        }
        //If the property is inherited, do not check any more (it must be equa if both objects inherit it)
        if (!this.hasOwnProperty(propName))
            continue;

        //Now the detail check and recursion

        //This returns the script back to the array comparing
        /**REQUIRES Array.equals**/
        if (this[propName] instanceof Array && object2[propName] instanceof Array) {
            // recurse into the nested arrays
            if (!this[propName].equals(object2[propName]))
                return (propName + ': ' + this[propName]);
        } else if (this[propName] instanceof Object && object2[propName] instanceof Object) {
            // recurse into another objects
            //console.log("Recursing to compare ", this[propName],"with",object2[propName], " both named \""+propName+"\"");
            if (!this[propName].equals(object2[propName]))
                return (propName + ': ' + this[propName]);
        }
        //Normal value comparison for strings and numbers
        else if (this[propName] != object2[propName]) {
            return (propName + ': ' + this[propName]);
        }
    }
    //If everything passed, let's say YES
    return 'Nothing!';  // Shouldn't get here!
}


Object.prototype.isResponse = function (object2) {
   objSrc = this[packetFields.FROM];
    objDest = this[packetFields.DEST];
    tempObj = this.slice();
    tempObj[packetFields.DEST] = objSrc;
    tempObj[packetFields.FROM] = objDest;
    

    //If the objects are now equal, return true.
    return (tempObj.equals(object2));

}