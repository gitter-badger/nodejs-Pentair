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
var currentStatus; // persistent object to hold pool equipment status.
var currentStatusBytes; //persistent variable to hold full bytes of pool status
var instruction = ''; //var to hold potential chatter instructions
var processingBuffer = 0; //flag to tell us if we are processing the buffer currently
var counter = 0; //log counter to help match messages with buffer in log

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
    TEMP_2: 19,
    AIR_TEMP: 22
}

const pumpPacketFields = {
    DEST: 0,
    FROM: 1,
    ACTION: 2,
    LENGTH: 3,
    CMD: 4, //
    MODE: 5, //?? Mode in pump status. Means something else in pump write/response
    DRIVESTATE: 6, //?? Drivestate in pump status.  Means something else in pump write/response
    WATTS: 7,
    RUN: 8,
    RPM: 9,
    GPM: 10, //Doesn't look to actually be GPM.  Maybe GPH?  Or something else completely
    PPC: 11, //??
    //12 Unknown
    ERR: 13,
    //14 Unknown
    TIMER: 14, //Have to explore
    //15, 16 Unknown
    HOUR: 17, //Hours
    MIN: 18 //Mins
}

const pumpAction = {
    1: 'WRITE', //Write commands to pump
    4: 'REMOTE', //Turn on/off pump control panel
    5: 'MODE', //Set pump mode
    6: 'RUN', //Set run mode
    7: 'STATUS' //Request status

}

const ctrl = {
    BROADCAST: 15,
    MAIN: 16,
    REMOTE: 32,
    WIRELESS: 34, //Looks like this is any communications through the wireless link (ScreenLogic on computer, iPhone...)
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



var winston = require('winston');
var winCount = 0;



var logger = new(winston.Logger)({
    transports: [
    new(winston.transports.File)({
            name: 'info-file',
            filename: 'pentair_info.log',
            level: 'silly'
        })
  ]
});

var fulllogger = new(winston.Logger)({
    transports: [
    new(winston.transports.File)({
            name: 'full-dump-file',
            filename: 'pentair_full_dump.log',
            level: 'silly'

        })
  ]
});


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
    logger.debug('total # equipment: ', equipmentCount) //17
    logger.debug('equipLen: ', circuitArr.length, '0 array: ', circuitArr[0].length) //3, 8
}








sp.on('open', function () {
    console.log('open');
    sp.on('data', function (data) {


        var brokeBufferLoop = false; //flag to see if there was a message at the end of the buffer

        if (typeof data2 === "undefined") {
            data2 = data.slice(0);
            if (loglevel) {
                logger.debug('assigning data2=data');
            }
        } else {
            data2 = Buffer.concat([data2, data]);
        }

        //put this in a static variable as the length might grow as we process more serial bus data!
        var currBufferLen = data2.length;


        //start to parse message at 250 bytes.  Is there a better time or way to know when the buffer has a full message or to start processing?
        if (currBufferLen > 50 && !processingBuffer) {

            //Data is being pushed to the buffer from the serial port faster than we are processing it.  Maybe just dump some data at some point?  But we would read >250 characters before this part of the code would finish so it was being called multiple times on the same (ever increasing) data2 buffer.  This flag should at least only let us process one part at a time.
            processingBuffer = 1;


            var chatter; //a {potential} message we have found on the bus
            var b = data2.toJSON();


            var i = 0;
            //-9 because the 8th byte is the length byte and we check for a full message below.
            loop1: {
                    for (i; i < currBufferLen - 9; i++) {

                        if (b.data[i] == 0) {
                            continue;
                        } else {
                            //look for Pentair preamble 255,0,255,165
                            if (b.data[i] == 255 && b.data[i + 1] == 0 && b.data[i + 2] == 255 && b.data[i + 3] == 165) {
                                //NEED MORE CHECKS FOR VARIOUS TYPES OF MESSAGES!  :-)

                                var chatterlen = b.data[i + 8] + 6 + 2; //chatterlen is length of following message not including checksum (need to add 6 for start of chatter (165,07,Dest,Src,02,chatterlen) and 2 for checksum)


                                //if we don't have the length bit in the buffer or the length of the message is less than the remaining buffer bytes
                                fulllogger.log('silly', 'Msg#:  %s   BUFFER IN MSG CHECK:  data2.len %s, chatterlen %s, i %s: TOTAL: %s True? %s ', counter, data2.length, chatterlen, i, data2.length - i - 1 - chatterlen, (data2.length - i - 2 - chatterlen) <= 0)





                                if (chatterlen == undefined || (data2.length - i - 2 - chatterlen) <= 0) {
                                    //reset the buffer starting with the current partial message
                                    fulllogger.debug('Msg#:  %s   Incomplete message at end of buffer.  Prepending message to empty buffer string.');
                                    brokeBufferLoop = true;

                                    data2 = data2.slice(i - 2)
                                    break loop1;
                                }

                                counter += 1;
                                fulllogger.info('Msg#: %s   Full buffer where message found: %s', counter, b.data.toString())

                                i += 3; //jump ahead to start of payload


                                fulllogger.silly('Msg#:  %s   Length should be: %s  at position: %s ', counter, chatterlen, i)


                                //iterate through the JSON array to pull out a valid message
                                loop2: {
                                    for (j = 0; j < chatterlen; j++) {
                                        if (j == 0) {
                                            var output = "     Found chatter (text): " //for logging, remove later
                                            chatter = new Array(chatterlen);
                                        }

                                        output += b.data[i + j];
                                        output += " ";

                                        chatter[j] = b.data[i + j];

                                        if (j == chatterlen - 1) {
                                            fulllogger.silly('Msg#:  %s   Extracting chatter from buffer: (length of chatter %s, position in buffer %s, start position of chatter in buffer %s) %s', counter, chatterlen, i, j, output)

                                            //This may be unnecessary; fixed code so we should get correct messages but will leave it for now
                                            if (chatter[j] == undefined || chatter[j - 1] == undefined || chatter[j - 1] == undefined) {
                                                fulllogger.warn('Msg#: %s   Chatter length MISMATCH.  len %s, i %s currBufferLen %s', counter, chatterlen, i, currBufferLen)
                                            }


                                            checksum(chatter, decode, counter);
                                            //skip ahead in the buffer for loop to the end of this message. 
                                            i += chatterlen;
                                            break loop1;
                                        }


                                    }
                                }


                            }
                            //this isn't working <-- CHECK
                            else if (b.data[i + 8] == 6) {
                                var str;
                                console.log('------->FOUND SOMETHING???')
                                i += 3;
                                chatterlen = 8;
                                for (j = 0; j < chatterlen; j++) {
                                    if (j == 0) {
                                        var output = "     Found SOMETHING chatter (text): " //for logging, remove later
                                        chatter = new Array(chatterlen);
                                    }

                                    output += b.data[i + j];
                                    output += " ";
                                    console.log('SOMETHING in chatter: (len %s, i %s, j %s) %s', chatterlen, i, j, output)
                                    chatter[j] = b.data[i + j];

                                    if (j == chatterlen - 1) {

                                        if (chatter[j] == undefined || chatter[j - 1] == undefined || chatter[j - 1] == undefined) {
                                            console.log('Chatter SOMETHING length MISMATCH.  len %s, i %s currBufferLen %s', chatterlen, i, currBufferLen)
                                        }


                                        //console.log(output + '\n');
                                        //console.log('processingBuffer:' + processingBuffer)
                                        //console.log('OR HERE????:' + chatter.toString())
                                        //logger.log('info', chatter.toString())
                                        checksum(chatter, decode);
                                        //skip ahead in the buffer for loop to the end of this message. 
                                        i += chatterlen;
                                        console.log('<-----FOUND SOMETHING???')
                                        break loop1;
                                    }


                                }

                            }

                        }


                    }
                }
                //slice the buffer from currBufferLen (what we have processed) to the end of the buffer
            if (brokeBufferLoop) {
                //we are here if we broke out of the buffer.  This means there is the start of a message in the last 9+/- bytes
                //We do this above!  Don't need it here.  data2 = data2.slice(currBufferLen - 9);
                fulllogger.debug('Msg#: %s   Incomplete message at end of buffer.  Sliced buffer so message is at beginning of buffer (sliced by %s) ', currBufferLen - 9);

            } else {
                //We should get here after every message.  Slice the buffer to a new message
                data2 = data2.slice(i);
                fulllogger.debug('Msg#: %s   At end of message.  Sliced off %s from remaining buffer.', currBufferLen);
            }

            processingBuffer = 0;
        };
    });

});


//Validate the checksum on the chatter
function checksum(chatterdata, callback, counter) {
    //make a copy so when we callback the decode method it isn't changing our log output in Winston
    fulllogger.silly("Msg#: %s   Checking checksum on chatter: ", chatterdata);
    var chatterCopy = chatterdata.slice(0);
    len = chatterCopy.length;

    //checksum is calculated by 256*2nd to last bit + last bit 
    var chatterdatachecksum = (chatterCopy[len - 2] * 256) + chatterCopy[len - 1];
    databytes = 0;

    // add up the data in the payload
    for (i = 0; i < len - 2; i++) {
        databytes += chatterCopy[i];
    }

    validChatter = (chatterdatachecksum == databytes);
    if (!validChatter) {
        fulllogger.warn('Msg#: %s   Mismatch on checksum:   %s!=%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
        console.log('Msg#: %s   Mismatch on checksum:    %s!=%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    } else {
        logger.info('Msg#: %s   Match on Checksum:    %s==%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    }

    //Go back to working on the original, not the copy
    //now that we calculated checksum, strip leading 165 and 10 as it is extraneous

    chatterCopy = chatterCopy.splice(2);
    //console.log("NewCD: ", newcd);
    fulllogger.silly("Msg#: %s   Chatterdata splice: %s --> %s ", counter, chatterdata, chatterCopy)
        //call new function to process message; if it isn't valid, we noted above so just don't continue
    if (validChatter) callback(chatterCopy, counter);
};

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
}

function printStatus(data1, data2) {
    str1 = clone(data1);
    str2 = clone(data2);

    spacepadding = '';
    spacepaddingNum = 19;
    for (i = 0; i <= spacepaddingNum; i++) {
        spacepadding += ' ';
    }


    header = '';
    header += (spacepadding + '      S       L                                                           W               A \n');
    header += (spacepadding + '      O       E           M   M   M                                       T               I \n');
    header += (spacepadding + '  D   U       N   H       O   O   O                                       R   T           R                                           C   C\n');
    header += (spacepadding + '  E   R       G   O   M   D   D   D                                       T   M           T                                           H   H\n');
    header += (spacepadding + '  S   C       T   U   I   E   E   E                                       M   P           M                                           K   K\n');
    header += (spacepadding + '  T   E       H   R   N   1   2   3                                       P   2           P                                           H   L\n');
    //                    e.g.  15, 16,  2, 29, 11, 33, 32,  0,  0,  0,  0,  0,  0,  0, 51,  0, 64,  4, 79, 79, 32,  0, 69,102,  0,  0,  7,  0,  0,182,215,  0, 13,  4,186

    //format status1 so numbers are three digits
    for (i = 0; i < str1.length - 1; i++) {
        str1[i] = pad(str1[i], 3);
    }
    str1 = 'Orig: ' + spacepadding.substr(6) + str1 + '\n';
    //format status2 the same

    if (data2 != null || data2 != undefined) {
        for (i = 0; i < str2.length - 1; i++) {
            str2[i] = pad(str2[i], 3);
        }
        str2 = ' New: ' + spacepadding.substr(6) + str2 + '\n'
    } else {
        str2 = ''
    }

    str = header + str1 + str2;

    return (str);
}

function pad(num, size) {
    //makes any digit returned as a string of length size (for outputting formatted byte text)
    var s = "   " + num;
    return s.substr(s.length - size);
}

function decode(data, counter) {
    var decoded = false;

    //uncomment the below line if you think the 'parser' is missing any messages.  It will output every message sent here.
    //console.log('Msg#: %s is %s', counter, JSON.stringify(data));  

    //this payload is good if heat command on pool is one of Heater/Solar Pref/Solar Only
    if (data.length == 35 && data[packetFields.FROM] == ctrl.MAIN && data[packetFields.DEST] == ctrl.BROADCAST) {


        //status will be our return object
        var status = {};

        //time returned in HH:MM (24 hour)  <-- need to clean this up so we don't get times like 5:3
        status.time = data[packetFields.HOUR] + ':' + data[packetFields.MIN];
        status.waterTemp = data[packetFields.WATER_TEMP];
        status.temp2 = data[packetFields.TEMP_2];
        status.airTemp = data[packetFields.AIR_TEMP];

        //Loop through the three bits that start at 3rd (and 4th/5th) bit in the data payload
        for (i = 0; i < circuitArr.length; i++) {
            //loop through all physical circuits within each of the bits
            for (j = 0; j < circuitArr[i].length; j++) {
                tempFeature = circuitArr[i][j]; //name of circuit
                equip = data[packetFields.EQUIP1 + i]
                status[tempFeature] = (equip & (1 << (j))) >> j ? "on" : "off"
            }
        }

        //Initialize static variable (currentStatus) if not defined, and log it.
        if (currentStatus == null || currentStatus == undefined) {
            currentStatus = clone(status);
            currentStatusBytes = data.slice(0);
            console.log('-->EQUIPMENT Msg#: %s \n Equipment Status: %O', counter, status)
            logger.info('Msg#: %s    Discovered initial pool settings: %s', counter, JSON.stringify(currentStatus))
            console.log(printStatus(data));
            console.log('\n <-- EQUIPMENT \n');
            decoded = true;
        } else {

            //Check if we have the same data
            //This should also significantly limit the amount of duplicate broadcast/chatter.  At a minimum, the packet should be different every minute (due to time).  If it is more than that, we need to explore further.



            if (!status.equals(currentStatus)) {
                //we are only checking our KNOWN objects.  There may be other differences and we'll recode for that shortly.


                console.log('-->EQUIPMENT Msg# %s (that we can identify)\n Equipment Status: %O', counter, currentStatus)

                console.log('Msg#: %s What\'s Different (first occurrence only?: %s', counter, currentStatus.whatsDifferent(status))
                console.log(printStatus(currentStatusBytes, data));
                console.log('\n <-- EQUIPMENT \n');


                currentStatus = clone(status);
                currentStatusBytes = data.slice(0);
                decoded = true;

            } else {
                //let's see if it is the exact same packet or if there are variations in the data we have not interpreted yet
                if (!data.equals(currentStatusBytes)) {
                    console.log('-->Variation in unknown status bytes Msg#: ', counter)
                    console.log(printStatus(currentStatusBytes, data));
                    console.log('<--Variation \n')
                    currentStatusBytes = data.slice(0);
                    decoded = true;
                }
                else{
                    console.log('Msg#: %s   Duplicate broadcast.', counter) 
                    decoded = true;
                }

            }

        }


        // if the time field is whacked, don't send any data.  <-- leftover code.  can probable eliminate
        d = status.time.split(":")
        if (parseInt(d[0]) < 24 && parseInt(d[1]) < 60) {
            if (loglevel) console.log('-->EQUIPMENT Msg#: ', counter, '\n Equipment Status verbose: ', JSON.stringify(status), '\n', parseChatter(data), '\n <-- EQUIPMENT \n');
        }
    } else if (((data[packetFields.FROM] == ctrl.PUMP1 || data[packetFields.FROM] == ctrl.PUMP2) && data[packetFields.DEST] == ctrl.MAIN) || ((data[packetFields.DEST] == ctrl.PUMP1 || data[packetFields.DEST] == ctrl.PUMP2) && data[packetFields.FROM] == ctrl.MAIN))

    //  --> Could be from/to control and from/to pump.  Check all????  Or is data length 8 sufficient
    //&& data[packetFields.FROM] == ctrl.MAIN  && (data[packetFields.DEST] == ctrl.PUMP1 || data[packetFields.DEST] == ctrl.PUMP2)
    {

        if (instruction == null || instruction == undefined || instruction == '') {
            instruction = data;
            console.log('Msg#: %s  Setting initial chatter as instruction: %s', counter, instruction)
        }

        var isResponse = data.isResponse(instruction);
        var ctrlType = data2;

        //Send request/response for pump status
        if (data[pumpPacketFields.ACTION] == 7) {
            if (data[pumpPacketFields.CMD] == 1) //Request pump status
            {
                console.log('Msg# %s   Main asking %s for status: %s', counter, ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data));
            } else //Response to request for status 
            {

                var status = {
                    pump: null,
                    run: null,
                    mode: null,
                    drivestate: null,
                    watts: null,
                    rpm: null,
                    gpm: null,
                    ppc: null,
                    err: null,
                    timer: null,
                    time: null

                }

                var pumpnum = (data[pumpPacketFields.FROM]).toString();
                //time returned in HH:MM (24 hour)  <-- need to clean this up so we don't get times like 5:3
                status.time = data[pumpPacketFields.HOUR] + ':' + data[pumpPacketFields.MIN];
                status.run = data[pumpPacketFields.CMD]
                status.pump = ctrlString[pumpnum];
                status.mode = data[pumpPacketFields.MODE]
                status.drivestate = data[pumpPacketFields.DRIVESTATE]
                status.watts = (data[pumpPacketFields.WATTS] * 256) + data[pumpPacketFields.WATTS + 1]
                status.rpm = (data[pumpPacketFields.RPM] * 256) + data[pumpPacketFields.RPM + 1]
                status.gpm = data[pumpPacketFields.GPM]
                status.ppc = data[pumpPacketFields.PPC]
                status.err = data[pumpPacketFields.ERR]
                status.timer = data[pumpPacketFields.TIMER]
                console.log('--> PUMP Msg#: ', counter, '\n', ctrlString[pumpnum], '\n Pump Status: ', JSON.stringify(status), '\n', 'Full Payload: ', JSON.stringify(data), '\n<-- PUMP ', ctrlString[pumpnum], '\n');
                decoded = true;
            }
        } else

        if (data[pumpPacketFields.ACTION] == 4) //Pump control panel on/off
        {
            if (data[pumpPacketFields.CMD] == 255) //Set pump control panel off (Main panel control only)
            {
                if (!isResponse) {
                    console.log('Msg# %s   Main asking %s for remote control (turn off pump control panel): %s', counter, ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data));
                    decoded = true;
                } else {
                    console.log('Msg#: %s   %s confirming it is in remote control: %s', counter, ctrlString[data[pumpPacketFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
            if (data[pumpPacketFields.CMD] == 0) //Set pump control panel on 
            {
                if (!isResponse) {
                    console.log('Msg# %s   Main asking %s for local control (turn on pump control panel): %s', counter, ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data))
                    decoded = true;
                } else {
                    console.log('Msg#: %s   %s confirming it is in local control: %s', counter, ctrlString[data[pumpPacketFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
        } else if (data[pumpPacketFields.ACTION] == 1) //Write command to pump
        {
            if (data[pumpPacketFields.LENGTH] == 4) //This might be the only packet where isResponse() won't work because the pump sends back a validation command
            {
                var pumpCommand = '';
                for (i = 1; i < data[pumpPacketFields.LENGTH]; i++) {
                    pumpCommand += data[i + pumpPacketFields.LENGTH] //Not sure if it is a coincidence that pumpPacketFields.LENGTH ==4, but the 4th byte is the start of the message.
                    pumpCommand += ', '
                }

                console.log('Msg# %s   Main asking %s to write a _%s_ command: %s', counter, ctrlString[data[pumpPacketFields.DEST]], pumpCommand, JSON.stringify(data));
                decoded = true;
            } else {
                var pumpResponse = ''
                pumpResponse += data[pumpPacketFields.LENGTH + 1] + ', ' + data[pumpPacketFields.LENGTH + 2]
                console.log('Msg# %s   %s sent response _%s_ to write command: %s', counter, ctrlString[data[pumpPacketFields.DEST]], pumpResponse, JSON.stringify(data));
                decoded = true;
            }


        } else if (data[pumpPacketFields.ACTION] == 5) //Set pump mode
        {
            if (!isResponse) {
                console.log('Msg# %s   Main asking %s to set pump mode to _%s_: %s', counter, ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                console.log('Msg# %s   %s confirmng it is in mode _%s_: %s', counter, ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            }

        } else if (data[pumpPacketFields.ACTION] == 6) //Set run mode
        {
            if (!isResponse) {
                console.log('Msg# %s   Main asking %s to set run to _%s_: %s', counter, ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                console.log('Msg# %s   %s confirming it is in run _%s_: %s', counter, ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            }
        }
        instruction = data.slice();
    } else if (((data[packetFields.FROM] == ctrl.REMOTE || data[packetFields.FROM] == ctrl.WIRELESS) && data[packetFields.DEST] == ctrl.MAIN) || ((data[packetFields.DEST] == ctrl.REMOTE || data[packetFields.DEST] == ctrl.WIRELESS) && data[packetFields.FROM] == ctrl.MAIN)) {
        if (data[packetFields.DEST] == 16) {
            var status = {

                source: null,
                destination: null,
                b3: null,
                b4: null,
                b5: null

            }
            status.source = data[packetFields.FROM]
            status.destination = data[packetFields.DEST]
            status.b3 = data[packetFields[2]]
            status.b4 = data[packetFields[3]]
            status.b5 = data[packetFields[4]]
            console.log('Msg# %s   %s asking %s to change _%s_: %s', counter, ctrlString[data[packetFields.FROM]], data[packetFields.DEST], 'something', JSON.stringify(data));
            decoded = true;
        } else {
                //something??
        }
    }
    /* else {
        //message not decodede  <-- this is probably reduntant from below
        
        if (typeof status == 'undefined') {

            if (instruction == null || instruction == undefined) {
                instruction = data;
            } else


            //is status a response to the instruction?
            if (data.isResponse(instruction)) {
                if (data.length == 8)
                    console.log('Msg#: %s   Chatter %s is acknowledgement to instruction %s: ', counter, JSON.stringify(data), JSON.stringify(instruction))
            } else {
                console.log('Msg#: %s   Unknown chatter: ', counter, JSON.stringify(data))
                instruction = data.slice();
            }
        }
    } */
    if (instruction == null || instruction == undefined) {
        instruction = data;
    } else
    if (!decoded) {
        fulllogger.debug('Msg#: %s   Starting to decode message.', counter)
        console.log('Msg#: %s is %s', counter, JSON.stringify(data));
        decoded = false;
    } else(decoded = false)
    return true; //fix this; turn into callback(?)  What do we want to do with it?
}

//This function just for visual/log usage.
function parseChatter(parsedata) {
    //make copy so we don't change the original by reference
    parsedataCopy = parsedata.slice(0);
    console.log(JSON.stringify(parsedataCopy));
    len = parsedataCopy.length;

    if (len == 35) { //Broadcast packet
        if (loglevel) {
            _equip1 = parsedataCopy[packetFields.EQUIP1]
            _equip2 = parsedataCopy[packetFields.EQUIP2]
            _equip3 = parsedataCopy[packetFields.EQUIP3]
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

        parsedataCopy[packetFields.FROM] = 'Src: ' + parsedataCopy[packetFields.FROM];
        parsedataCopy[packetFields.DEST] = 'Dest: ' + parsedataCopy[packetFields.DEST];
        parsedataCopy[packetFields.ACTION] = 'Action: ' + parsedataCopy[packetFields.ACTION];
        parsedataCopy[packetFields.DATASIZE] = 'Len: ' + parsedataCopy[packetFields.DATASIZE];
        parsedataCopy[packetFields.HOUR] = 'Hr: ' + parsedataCopy[packetFields.HOUR];
        parsedataCopy[packetFields.MIN] = 'Min: ' + parsedataCopy[packetFields.MIN];
        parsedataCopy[packetFields.EQUIP1] = 'MODE1: ' + parsedataCopy[packetFields.EQUIP1];
        parsedataCopy[packetFields.EQUIP2] = 'MODE2: ' + parsedataCopy[packetFields.EQUIP2];
        parsedataCopy[packetFields.EQUIP3] = 'MODE3: ' + parsedataCopy[packetFields.EQUIP3];
        parsedataCopy[packetFields.WATER_TEMP] = 'WtrTemp: ' + parsedataCopy[packetFields.WATER_TEMP];
        parsedataCopy[packetFields.AIR_TEMP] = 'AirTemp: ' + parsedataCopy[packetFields.AIR_TEMP];
        parsedataCopy[len - 1] = 'ChkH: ' + parsedataCopy[len - 1];
        parsedataCopy[len - 2] = 'ChkL: ' + parsedataCopy[len - 2];
        return (JSON.stringify(parsedataCopy) + ' & Length: ', len);
    } else if (len == 7) //Pump actions?
    {
        returnStr = 'Unknown chatter of length: %s to Dest: %s from %S ', len, ctrlString[parsedataCopy[packetFields.DEST]], ctrlString[parsedataCopy[packetFields.SRC]];
        parsedataCopy[packetFields.DEST] = 'Dest: ' + parsedataCopy[packetFields.DEST];
        parsedataCopy[packetFields.FROM] = 'Src: ' + parsedataCopy[packetFields.FROM];
        return (returnStr + 'Pump Instructions? \n', JSON.stringify(parsedataCopy) + ' & Length: ', len);
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
    var diffString = '';
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
    return 'Nothing!'; // Shouldn't get here!
}


function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

Object.prototype.isResponse = function (object2) {

    //make copies of the object so we assign the variables by value and not change the originals (by reference)
    //need to use the clone function because slice doesn't work on objects for by value copy
    tempObj = clone(this);

    //this doesn't work -- it copies by reference not by value
    //tempObj = this.slice();

    objSrc = this[packetFields.FROM];
    objDest = this[packetFields.DEST];
    tempObj[packetFields.DEST] = objSrc;
    tempObj[packetFields.FROM] = objDest;


    //If the objects are now equal, return true.
    return (tempObj.equals(object2));

}