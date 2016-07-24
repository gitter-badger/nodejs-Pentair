(function () {
    'use strict';
    // this function is strict...
}());



const serialport = require("serialport");
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
var currentStatus; // persistent object to hold pool equipment status.
var currentStatusBytes; //persistent variable to hold full bytes of pool status
var currentWhatsDifferent; //persistent variable to hold what's different
var instruction = ''; //var to hold potential chatter instructions
var processingBuffer = 0; //flag to tell us if we are processing the buffer currently
var counter = 0; //log counter to help match messages with buffer in log


//To do: Clean up the following... consolidate or at least make it consistent
var loglevel = 0; //1=more, 0=less
var pumpMessages = 0; //variable if we want to output pump messages or not
var duplicateMessages = 0; //variable if we want to output duplicate broadcast messages
var showConsoleNotDecoded = 0; //variable to hide any unknown messages
var showConfigMessages = 0; //variable to show/hide configuration messages

//search placeholders for sockets.io Search
var searchMode = 'stop'
var searchSrc = '';
var searchDest = '';
var searchAction = '';


var customNameArr = [];

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
    UOM: 13, //Celsius (4) or Farenheit (0); Also Service/Timeout.  See strRunMode below.
    VALVES: 14,
    UNKNOWN: 17, //Something to do with heat.
    WATER_TEMP: 18,
    TEMP_2: 19,
    HEATER_ACTIVE: 20, //0=off.  32=on.  More here?
    AIR_TEMP: 22,
    SOLAR_TEMP: 23,
    HEATER_MODE: 26,
}

const pumpPacketFields = {
    DEST: 0,
    FROM: 1,
    ACTION: 2,
    LENGTH: 3,
    CMD: 4, //
    MODE: 5, //?? Mode in pump status. Means something else in pump write/response
    DRIVESTATE: 6, //?? Drivestate in pump status.  Means something else in pump write/response
    WATTSH: 7,
    WATTSL: 8,
    RPMH: 9,
    RPML: 10,
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

const strCircuitName = {
    1: 'AERATOR',
    2: 'AIR BLOWER',
    3: 'AUX 1',
    4: 'AUX 2',
    5: 'AUX 3',
    6: 'AUX 4',
    7: 'AUX 5',
    8: 'AUX 6',
    9: 'AUX 7',
    10: 'AUX 8',
    11: 'AUX 9',
    12: 'AUX 10',
    13: 'BACKWASH',
    14: 'BACK LIGHT',
    15: 'BBQ LIGHT',
    16: 'BEACH LIGHT',
    17: 'BOOSTER PUMP',
    18: 'BUG LIGHT',
    19: 'CABANA LTS',
    20: 'CHEM. FEEDER',
    21: 'CHLORINATOR',
    22: 'CLEANER',
    23: 'COLOR WHEEL',
    24: 'DECK LIGHT',
    25: 'DRAIN LINE',
    26: 'DRIVE LIGHT',
    27: 'EDGE PUMP',
    28: 'ENTRY LIGHT',
    29: 'FAN',
    30: 'FIBER OPTIC',
    31: 'FIBER WORKS',
    32: 'FILL LINE',
    33: 'FLOOR CLNR',
    34: 'FOGGER',
    35: 'FOUNTAIN',
    36: 'FOUNTAIN 1',
    37: 'FOUNTAIN 2',
    38: 'FOUNTAIN 3',
    39: 'FOUNTAINS',
    40: 'FRONT LIGHT',
    41: 'GARDEN LTS',
    42: 'GAZEBO LTS',
    43: 'HIGH SPEED',
    44: 'HI-TEMP',
    45: 'HOUSE LIGHT',
    46: 'JETS',
    47: 'LIGHTS',
    48: 'LOW SPEED',
    49: 'LO-TEMP',
    50: 'MALIBU LTS',
    51: 'MIST',
    52: 'MUSIC',
    53: 'NOT USED',
    54: 'OZONATOR',
    55: 'PATH LIGHTS',
    56: 'PATIO LTS',
    57: 'PERIMETER L',
    58: 'PG2000',
    59: 'POND LIGHT',
    60: 'POOL PUMP',
    61: 'POOL',
    62: 'POOL HIGH',
    63: 'POOL LIGHT',
    64: 'POOL LOW',
    65: 'SAM',
    66: 'POOL SAM 1',
    67: 'POOL SAM 2',
    68: 'POOL SAM 3',
    69: 'SECURITY LT',
    70: 'SLIDE',
    71: 'SOLAR',
    72: 'SPA',
    73: 'SPA HIGH',
    74: 'SPA LIGHT',
    75: 'SPA LOW',
    76: 'SPA SAL',
    77: 'SPA SAM',
    78: 'SPA WTRFLL',
    79: 'SPILLWAY',
    80: 'SPRINKLERS',
    81: 'STREAM',
    82: 'STATUE LT',
    83: 'SWIM JETS',
    84: 'WTR FEATURE',
    85: 'WTR FEAT LT',
    86: 'WATERFALL',
    87: 'WATERFALL 1',
    88: 'WATERFALL 2',
    89: 'WATERFALL 3',
    90: 'WHIRLPOOL',
    91: 'WTRFL LGHT',
    92: 'YARD LIGHT',
    93: 'AUX EXTRA',
    94: 'FEATURE 1',
    95: 'FEATURE 2',
    96: 'FEATURE 3',
    97: 'FEATURE 4',
    98: 'FEATURE 5',
    99: 'FEATURE 6',
    100: 'FEATURE 7',
    101: 'FEATURE 8',
    200: 'USERNAME-01',
    201: 'USERNAME-02',
    202: 'USERNAME-03',
    203: 'USERNAME-04',
    204: 'USERNAME-05',
    205: 'USERNAME-06',
    206: 'USERNAME-07',
    207: 'USERNAME-08',
    208: 'USERNAME-09',
    209: 'USERNAME-10'
}

const strCircuitFunction = {
    0: 'Generic',
    1: 'Spa',
    2: 'Pool',
    5: 'Master Cleaner',
    7: 'Light',
    9: 'SAM Light',
    10: 'SAL Light',
    11: 'Photon Gen',
    12: 'color wheel',
    14: 'Spillway',
    15: 'Floor Cleaner',
    16: 'Intellibrite',
    17: 'MagicStream',
    19: 'Not Used',
    64: 'Freeze protection on'
}

/*const strUOM = {
    //This should be renamed.  Originally, it was only known this byte was C or F.  Later it was discovered to have more data.
    0: String.fromCharCode(176) + ' Farenheit', //Also, "Auto" on the valves button  0x00000000
    4: String.fromCharCode(176) + ' Celsius',  //0x00000100
    //strUOMSTATUS is part of the same bitmask
}*/


const strRunMode = {
    //same bit as UOM.  Need to fix naming.
    0: 'Auto', //0x00000000
    1: 'Service', //0x00000001
    4: 'Celsius', //if 1, Celsius.  If 0, Farenheit
    128: '/Timeout' //Timeout always appears with Service; eg this bit has not been observed to be 128 but rather 129.  Not sure if the timer is in the controller.  0x10000001

}


const strValves = {
    3: 'Pool',
    15: 'Spa',
    48: 'Heater' // I've seen the value of 51.  I think it is Pool + Heater.  Need to investigate.
}

const heatMode = {
    //Pentair controller sends the pool and spa heat status as a 4 digit binary byte from 0000 (0) to 1111 (15).  The left two (xx__) is for the spa and the right two (__xx) are for the pool.  EG 1001 (9) would mean 10xx = 2 (Spa mode Solar Pref) and xx01 = 1 (Pool mode Heater)
    0: 'Off',
    1: 'Heater',
    2: 'Solar Pref',
    3: 'Solar Only'
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
const fs = require('fs');
var poolConfig = JSON.parse(fs.readFileSync(configurationFile));


//-----array format
var j = 0;
var circuitArr = [
    [], //Circuits 0-7
    [], //Circuits 8-15
    [] //Circuits 16-?
];


/*  <-- Delete this section if we can read the configuration from the broadcast
for (var key in poolConfig.Pentair) {
    if (poolConfig.Pentair.hasOwnProperty(key)) {
        var myEQ = 0;
        if (j < 8) {
            myEQ = 0; //8 bits for first mode byte
        } else if (j >= 8 && j < 16) {
            (myEQ = 1) //8 bits for 2nd mode byte
        } else(myEQ = 2); //8 bits for 3rd mode byte
        circuitArr[myEQ].push(poolConfig.Pentair[key]);
        j++;
    }
}
*/

console.log('*******************************')
console.log('\n Important changes:');
console.log('\n Configuration is now read from your pool.  In order to force the controller to broadcast the configuration, change the setpoint of your heater (or any configuration that is saved in the controller) and it will rebroadcast the pool configuration.');
console.log('\n I am working on writing back to the bus and once I can successfully do this I will ask the controller for the config so this step is not necessary.');
console.log('\n Visit http://_your_machine_name_:3000 to see a basic UI');
console.log('\n Visit http://_your_machine_name_:3000/debug.html for a way to listen for specific messages\n\n');
console.log('*******************************')

//return a given equipment name given the circuit # 0-16++
function circuitArrStr(equip) {
    equip = equip - 1; //because equip starts at 1 but array starts at 0
    if (equip < 8) {
        return circuitArr[0][equip]
    } else if (equip >= 8 && equip < 16) {
        return circuitArr[1][equip - 8]
    } else {
        return circuitArr[2][equip - 16]
    }
    return 'Error';
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
    /*var largeMessage = [00, 255, 165, 16, 34, 134, 2, 9, 1, 1, 115];
    console.log('Calling write');
    sp.write(largeMessage, function () {
        console.log('Write callback returned');
        // At this point, data may still be buffered and not sent out over the port yet
        // write function returns asynchronously even on the system level.
        console.log('Calling drain');
        sp.drain(function () {
            console.log('Drain callback returned');
            // Now the data has "left the pipe" (tcdrain[1]/FlushFileBuffers[2] finished blocking).
            // [1] http://linux.die.net/man/3/tcdrain
            // [2] http://msdn.microsoft.com/en-us/library/windows/desktop/aa364439(v=vs.85).aportx
        });
    });*/
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
                                fulllogger.log('silly', 'Msg#  %s   BUFFER IN MSG CHECK:  data2.len %s, chatterlen %s, i %s: TOTAL: %s True? %s ', counter, data2.length, chatterlen, i, data2.length - i - 1 - chatterlen, (data2.length - i - 2 - chatterlen) <= 0)





                                if (chatterlen == undefined || (data2.length - i - 2 - chatterlen) <= 0) {
                                    //reset the buffer starting with the current partial message
                                    fulllogger.debug('Msg#  %s   Incomplete message at end of buffer.  Prepending message to empty buffer string.');
                                    brokeBufferLoop = true;

                                    data2 = data2.slice(i - 2)
                                    break loop1;
                                }

                                counter += 1;
                                fulllogger.info('Msg# %s   Full buffer where message found: %s', counter, b.data.toString())

                                i += 3; //jump ahead to start of payload


                                fulllogger.silly('Msg#  %s   Length should be: %s  at position: %s ', counter, chatterlen, i)


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
                                            fulllogger.silly('Msg# %s   Extracting chatter from buffer: (length of chatter %s, position in buffer %s, start position of chatter in buffer %s) %s', counter, chatterlen, i, j, output)

                                            //This may be unnecessary; fixed code so we should get correct messages but will leave it for now
                                            if (chatter[j] == undefined || chatter[j - 1] == undefined || chatter[j - 1] == undefined) {
                                                fulllogger.warn('Msg# %s   Chatter length MISMATCH.  len %s, i %s currBufferLen %s', counter, chatterlen, i, currBufferLen)
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
                                console.log('data: ', JSON.stringify(b.data))
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
                fulllogger.debug('Incomplete message at end of buffer.  Sliced buffer so message is at beginning of buffer (sliced by %s) ', currBufferLen - 9);

            } else {
                //We should get here after every message.  Slice the buffer to a new message
                data2 = data2.slice(i);
                fulllogger.debug('At end of message.  Sliced off %s from remaining buffer.', currBufferLen);
            }

            processingBuffer = 0;
        };
    });

});


//Validate the checksum on the chatter
function checksum(chatterdata, callback, counter) {
    //make a copy so when we callback the decode method it isn't changing our log output in Winston
    fulllogger.silly("Msg# %s   Checking checksum on chatter: ", chatterdata);
    var chatterCopy = chatterdata.slice(0);
    var len = chatterCopy.length;

    //checksum is calculated by 256*2nd to last bit + last bit 
    var chatterdatachecksum = (chatterCopy[len - 2] * 256) + chatterCopy[len - 1];
    var databytes = 0;

    // add up the data in the payload
    for (var i = 0; i < len - 2; i++) {
        databytes += chatterCopy[i];
    }

    var validChatter = (chatterdatachecksum == databytes);
    if (!validChatter) {
        fulllogger.warn('Msg# %s   Mismatch on checksum:   %s!=%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
        console.log('Msg# %s   Mismatch on checksum:    %s!=%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    } else {
        logger.info('Msg# %s   Match on Checksum:    %s==%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    }

    //Go back to working on the original, not the copy
    //now that we calculated checksum, strip leading 165 and 10 as it is extraneous

    chatterCopy = chatterCopy.splice(2);
    //console.log("NewCD: ", newcd);
    fulllogger.silly("Msg# %s   Chatterdata splice: %s --> %s ", counter, chatterdata, chatterCopy)
        //call new function to process message; if it isn't valid, we noted above so just don't continue
    if (validChatter) callback(chatterCopy, counter);
};

function dec2bin(dec) {
    return (dec >>> 0).toString(2);
}

function printStatus(data1, data2) {
    str1 = clone(data1);
    str2 = clone(data2);
    str3 = ''; //delta
    spacepadding = '';
    spacepaddingNum = 19;
    for (var i = 0; i <= spacepaddingNum; i++) {
        spacepadding += ' ';
    }


    header = '';
    header += (spacepadding + '      S       L                                           V           H   W       H       A   S           H\n');
    header += (spacepadding + '      O       E           M   M   M                       A           T   T       T       I   O           E\n');
    header += (spacepadding + '  D   U       N   H       O   O   O                   U   L           R   R   T   R       R   L           A                           C   C\n');
    header += (spacepadding + '  E   R   C   G   O   M   D   D   D                   O   V           M   T   M   _       T   T           T                           H   H\n');
    header += (spacepadding + '  S   C   M   T   U   I   E   E   E                   M   E           D   M   P   O       M   M           M                           K   K\n');
    header += (spacepadding + '  T   E   D   H   R   N   1   2   3                       S           E   P   2   N       P   P           D                           H   L\n');
    //                    e.g.  15, 16,  2, 29, 11, 33, 32,  0,  0,  0,  0,  0,  0,  0, 51,  0, 64,  4, 79, 79, 32,  0, 69,102,  0,  0,  7,  0,  0,182,215,  0, 13,  4,186


    //compare arrays so we can mark which are different
    //doing string 2 first so we can compare string arrays
    if (data2 != null || data2 != undefined) {
        for (var i = 0; i < str2.length - 1; i++) {
            if (str1[i] == str2[i]) {
                str3 += '    '
            } else {
                str3 += '   *'
            }
            str2[i] = pad(str2[i], 3);
        }
        str2 = ' New: ' + spacepadding.substr(6) + str2 + '\n'
        str3 = 'Diff:' + spacepadding.substr(6) + str3 + '\n'
    } else {
        str2 = ''
    }


    //format status1 so numbers are three digits
    for (var i = 0; i < str1.length - 1; i++) {
        str1[i] = pad(str1[i], 3);
    }
    str1 = 'Orig: ' + spacepadding.substr(6) + str1 + '\n';





    str = header + str1 + str2 + str3;

    return (str);
}

function pad(num, size) {
    //makes any digit returned as a string of length size (for outputting formatted byte text)
    var s = "   " + num;
    return s.substr(s.length - size);
}

function decode(data, counter) {
    var decoded = false;

    //when searchMode (from socket.io) is in 'start' status, any matching packets will be set to the browser at http://machine.ip:3000/debug.html
    if (searchMode == 'start') {

        var resultStr = 'Msg#: ' + counter + ' Data: ' + JSON.stringify(data)
        if (searchAction == data[packetFields.ACTION] && searchSrc == data[packetFields.FROM] && searchDest == data[packetFields.DEST]) {
            io.sockets.emit('searchResults',
                resultStr
            )
        }
    }


    //uncomment the below line if you think the 'parser' is missing any messages.  It will output every message sent here.
    //console.log('Msg# %s is %s', counter, JSON.stringify(data));  

    //this payload is good if heat command on pool is one of Heater/Solar Pref/Solar Only
    if (data[packetFields.FROM] == ctrl.MAIN && data[packetFields.DEST] == ctrl.BROADCAST) {
        if (data.length == 35) //if (data[packetFields.ACTIOn] == 2) 
        {

            //status will be our return object
            var status = {};

            //time returned in HH:MM (24 hour)  <-- need to clean this up so we don't get times like 5:3
            status.time = data[packetFields.HOUR] + ':' + data[packetFields.MIN];
            status.waterTemp = data[packetFields.WATER_TEMP];
            status.temp2 = data[packetFields.TEMP_2];
            status.airTemp = data[packetFields.AIR_TEMP];
            status.solarTemp = data[packetFields.SOLAR_TEMP];
            status.poolHeatMode = heatMode[data[packetFields.UNKNOWN] & 3]; //mask the data[6] with 0011
            status.spaHeatMode = heatMode[(data[packetFields.UNKNOWN] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places

            status.poolHeatMode2 = heatMode[data[packetFields.HEATER_MODE] & 3]; //mask the data[6] with 0011
            status.spaHeatMode2 = heatMode[(data[packetFields.HEATER_MODE] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places

            status.valves = strValves[data[packetFields.VALVES]];
            status.runmode = strRunMode[data[packetFields.UOM] & 129]; // more here?
            status.UOM = String.fromCharCode(176) + ((data[packetFields.UOM] & 4) >> 3) ? ' Farenheit' : ' Celsius';
            if (data[packetFields.HEATER_ACTIVE] == 0) {
                status.HEATER_ACTIVE = 'Off'
            } else
            if (data[packetFields.HEATER_ACTIVE] == 32) {
                status.HEATER_ACTIVE = 'Heater On'
            } else {
                status.HEATER_ACTIVE = 'Unknown'
            };


            //Loop through the three bits that start at 3rd (and 4th/5th) bit in the data payload
            for (var i = 0; i < circuitArr.length; i++) {
                //loop through all physical circuits within each of the bits
                for (j = 0; j < circuitArr[i].length; j++) {
                    var tempFeature = circuitArr[i][j]; //name of circuit
                    equip = data[packetFields.EQUIP1 + i]
                    status[tempFeature] = (equip & (1 << (j))) >> j ? "on" : "off"
                }
            }

            //Initialize static variable (currentStatus) if not defined, and log it.
            if (currentStatus == null || currentStatus == undefined) {
                currentStatus = clone(status);
                currentStatusBytes = data.slice(0);
                console.log('-->EQUIPMENT Msg# %s   \n Equipment Status: %O', counter, status)
                logger.info('Msg# %s   Discovered initial pool settings: %s', counter, JSON.stringify(currentStatus))
                console.log(printStatus(data));
                console.log('\n <-- EQUIPMENT \n');
                decoded = true;
            } else {

                //Check if we have the same data
                //This should also significantly limit the amount of duplicate broadcast/chatter.  At a minimum, the packet should be different every minute (due to time).  If it is more than that, we need to explore further.



                if (!status.equals(currentStatus)) {
                    //we are only checking our KNOWN objects.  There may be other differences and we'll recode for that shortly.


                    console.log('-->EQUIPMENT Msg# %s   \n Equipment Status: ', counter, currentStatus)
                    currentWhatsDifferent = currentStatus.whatsDifferent(status);
                    console.log('Msg# %s   What\'s Different?: %s', counter, currentWhatsDifferent)
                    console.log(printStatus(currentStatusBytes, data));
                    console.log('\n <-- EQUIPMENT \n');


                    currentStatus = clone(status);
                    currentStatusBytes = data.slice(0);
                    decoded = true;
                    io.sockets.emit('status',
                        currentStatus
                    )

                } else {
                    //let's see if it is the exact same packet or if there are variations in the data we have not interpreted yet
                    if (!data.equals(currentStatusBytes)) {
                        console.log('-->Variation in unknown status bytes Msg# ', counter)
                        console.log(printStatus(currentStatusBytes, data));
                        console.log('<--Variation \n')
                        currentStatusBytes = data.slice(0);
                        decoded = true;
                    } else {
                        if (duplicateMessages) console.log('Msg# %s   Duplicate broadcast.', counter)
                        decoded = true;
                    }

                }

            }


            // if the time field is whacked, don't send any data.  <-- leftover code.  can probable eliminate
            d = status.time.split(":");
            if (parseInt(d[0]) < 24 && parseInt(d[1]) < 60) {
                if (loglevel) console.log('-->EQUIPMENT Msg# ', counter, '\n Equipment Status verbose: ', JSON.stringify(status), '\n', parseChatter(data), '\n <-- EQUIPMENT \n');
            }
        } else if (data[packetFields.ACTION] == 5) {

        } else

        if (data[packetFields.ACTION] == 10) // Get Custom Names
        {
            var customName = '';
            for (var i = 5; i < 16; i++) {
                if (data[i] > 0 && data[i] < 251) //251 is used to terminate the custom name string if shorter than 11 digits
                {
                    //console.log('i: %s and data[i]: %s',i, data[i])
                    customName += String.fromCharCode(data[i])
                };
            }
            if (showConfigMessages) {
                console.log('Msg# %s  Custom Circuit Name Raw:  %s', counter, JSON.stringify(data))
                console.log('Msg# %s  Custom Circuit Name Decoded: "%s"', counter, customName)
            }
            //push method works because the names are output in orde.

            customNameArr[data[4]] = customName;

            if (data[4] == 9) {
                console.log('\nCustom Circuit Names retrieved from configuration: \n [%s]\n ', customNameArr)
            }


            //parseInt(n,16).toString(2)

        } else

        if (data[packetFields.ACTION] == 11) // Get Circuit Names
        {


            var whichCircuit = 0;
            if (data[4] < 8) {
                whichCircuit = 0; //8 bits for first mode byte
            } else if (data[4] >= 8 && data[4] < 16) {
                (whichCircuit = 1) //8 bits for 2nd mode byte
            } else(whichCircuit = 2); //8 bits for 3rd mode byte

            var freezeProtection;
            if ((data[5] & 64) == 64) {
                freezeProtection = 'On'
            } else {
                freezeProtection = 'OFF'
            }
            //The &63 masks to 00111111 because 01000000 is freeze protection bit
            if (showConfigMessages) {
                console.log('Msg# %s  Circuit Info  %s', counter, JSON.stringify(data))
                console.log('Msg# %s  CIRCUIT NUMBER: %s  CIRCUIT NAME: %s(%s)  CIRCUIT FUNCTION: %s(%s, %s)  FREEZE PROTECTION: %s(masked:%s)', counter, data[4], strCircuitName[data[6]], data[6], strCircuitFunction[data[5] & 63], data[5], data[5] & 63, freezeProtection, data[5] & 64)
            }


            //if the ID of the circuit name is 1-101 then it is a standard name.  If it is 200-209 it is a custom name.  The mapping between the string value in the getCircuitNames and getCustomNames is 200.  So subtract 200 from the circuit name to get the id in the custom name array.
            //data[4]-1 because this array starts at 1 and JS arrays start at 0.
            //-(8*whichCircuit) because this will subtract 0, 8 or 16 from the index so each secondary index will start at 0


            if (data[6] < 200) {
                circuitArr[whichCircuit][data[4] - (8 * whichCircuit) - 1] = strCircuitName[data[6]];
            } else {
                if (showConfigMessages) console.log('mapping %s to %s', strCircuitName[data[6]], customNameArr[data[6] - 200]);
                circuitArr[whichCircuit][data[4] - (8 * whichCircuit) - 1] = customNameArr[data[6] - 200];
            }
            if (showConfigMessages) console.log('indexof: %s %s', strCircuitName[data[6]], circuitArr.indexOf(strCircuitName[data[6]]))
            if (data[4] == 18) console.log('Circuit Array Discovered from configuration: \n[[%s]]\n', circuitArr.join('],\n['))

        } else

        if (data[packetFields.ACTION] == 17) // Get Schedules
        {
            var schedule = {};
            schedule.ID = data[4];


            var whichCircuit = 0;
            if (data[5] < 8) {
                whichCircuit = 0; //8 bits for first mode byte
            } else if (data[5] >= 8 && data[5] < 16) {
                (whichCircuit = 1) //8 bits for 2nd mode byte
            } else(whichCircuit = 2); //8 bits for 3rd mode byte
            schedule.CIRCUIT = circuitArr[whichCircuit][data[5] - (8 * whichCircuit) - 1];

            if (data[6] == 25) //25 = Egg Timer 
            {
                schedule.MODE = 'Egg Timer'
                schedule.DURATION = data[8] + ':' + data[9];
            } else {
                schedule.MODE = 'Schedule'
                schedule.DURATION = 'n/a'
                schedule.START_TIME = data[6] + ':' + data[7];
                schedule.END_TIME = data[8] + ':' + data[9];
            }

            schedule.DAYS = '';

            if (data[10] == 255) {
                schedule.DAYS += 'EVERY DAY'
            } else { //0 = none
                if ((data[10] & 129) == 129) schedule.DAYS += 'Sunday '; //129
                if ((data[10] & 2) >> 1 == 1) schedule.DAYS += 'Monday '; // 2?
                if ((data[10] & 4) >> 2 == 1) schedule.DAYS += 'Tuesday '; // 4
                if ((data[10] & 8) >> 3 == 1) schedule.DAYS += 'Wednesday '; //8
                if ((data[10] & 16) >> 4 == 1) schedule.DAYS += 'Thursday '; //16
                if ((data[10] & 32) >> 5 == 1) schedule.DAYS += 'Friday '; //32
                if ((data[10] & 64) >> 6 == 1) schedule.DAYS += 'Saturday '; //64
            }



            if (showConfigMessages) console.log('\nMsg# %s  Schedule  %s', counter, JSON.stringify(data))
            if (schedule.MODE == 'Egg Timer') {
                console.log('Msg# %s  Schedule: ID:%s  CIRCUIT:(%s)%s  MODE:%s  DURATION:%s  ', counter, schedule.ID, data[5], schedule.CIRCUIT, schedule.MODE, schedule.DURATION)
            } else {
                console.log('Msg# %s  Schedule: ID:%s  CIRCUIT:(%s)%s  MODE:%s  START_TIME:%s  END_TIME:%s  DAYS:(%s)%s', counter, schedule.ID, data[5], schedule.CIRCUIT, schedule.MODE, schedule.START_TIME, schedule.END_TIME, data[10], schedule.DAYS)
            }


        }

    } else


    if (((data[packetFields.FROM] == ctrl.PUMP1 || data[packetFields.FROM] == ctrl.PUMP2) && data[packetFields.DEST] == ctrl.MAIN) || ((data[packetFields.DEST] == ctrl.PUMP1 || data[packetFields.DEST] == ctrl.PUMP2) && data[packetFields.FROM] == ctrl.MAIN))

    //  --> Could be from/to control and from/to pump.  Check all????  Or is data length 8 sufficient
    //&& data[packetFields.FROM] == ctrl.MAIN  && (data[packetFields.DEST] == ctrl.PUMP1 || data[packetFields.DEST] == ctrl.PUMP2)
    {

        if (instruction == null || instruction == undefined || instruction == '') {
            instruction = data;
            console.log('Msg# %s   Setting initial chatter as instruction: %s', counter, instruction)
        }

        var isResponse = data.isResponse(instruction);
        var ctrlType = data2;

        //Send request/response for pump status
        if (data[pumpPacketFields.ACTION] == 7) {
            if (data[pumpPacketFields.CMD] == 1) //Request pump status
            {
                if (pumpMessages) console.log('Msg# %s   Main asking %s for status: %s', counter, ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data));
                decoded = true;
            } else //Response to request for status 
            {

                var status = {
                    pump: null,
                    run: null,
                    mode: null,
                    drivestate: null,
                    watts: null,
                    rpm: null,
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
                status.watts = (data[pumpPacketFields.WATTSH] * 256) + data[pumpPacketFields.WATTSL]
                status.rpm = (data[pumpPacketFields.RPMH] * 256) + data[pumpPacketFields.RPML]
                status.ppc = data[pumpPacketFields.PPC]
                status.err = data[pumpPacketFields.ERR]
                status.timer = data[pumpPacketFields.TIMER]
                if (pumpMessages) console.log('--> PUMP Msg# ', counter, '\n', ctrlString[pumpnum], '\n Pump Status: ', JSON.stringify(status), '\n', 'Full Payload: ', JSON.stringify(data), '\n<-- PUMP ', ctrlString[pumpnum], '\n');
                decoded = true;
            }
        } else

        if (data[pumpPacketFields.ACTION] == 4) //Pump control panel on/off
        {
            if (data[pumpPacketFields.CMD] == 255) //Set pump control panel off (Main panel control only)
            {
                if (!isResponse) {
                    if (pumpMessages) console.log('Msg# %s   %s asking %s for remote control (turn off pump control panel): %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data));
                    decoded = true;
                } else {
                    if (pumpMessages) console.log('Msg# %s   %s confirming it is in remote control: %s', counter, ctrlString[data[pumpPacketFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
            if (data[pumpPacketFields.CMD] == 0) //Set pump control panel on 
            {
                if (!isResponse) {
                    if (pumpMessages) console.log('Msg# %s   %s asking %s for local control (turn on pump control panel): %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[pumpPacketFields.DEST]], JSON.stringify(data))
                    decoded = true;
                } else {
                    if (pumpMessages) console.log('Msg# %s   %s confirming it is in local control: %s', counter, ctrlString[data[pumpPacketFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
        } else if (data[pumpPacketFields.ACTION] == 1) //Write command to pump
        {
            if (data[pumpPacketFields.LENGTH] == 4) //This might be the only packet where isResponse() won't work because the pump sends back a validation command
            {
                var pumpCommand = '';
                for (var i = 1; i < data[pumpPacketFields.LENGTH]; i++) {
                    pumpCommand += data[i + pumpPacketFields.LENGTH] //Not sure if it is a coincidence that pumpPacketFields.LENGTH ==4, but the 4th byte is the start of the message.
                    pumpCommand += ', '
                }

                if (pumpMessages) console.log('Msg# %s   %s asking %s to write a _%s_ command: %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[pumpPacketFields.DEST]], pumpCommand, JSON.stringify(data));
                decoded = true;
            } else {
                var pumpResponse = ''
                pumpResponse += data[pumpPacketFields.LENGTH + 1] + ', ' + data[pumpPacketFields.LENGTH + 2]
                if (pumpMessages) console.log('Msg# %s   %s sent response _%s_ to write command: %s', counter, ctrlString[data[pumpPacketFields.FROM]], pumpResponse, JSON.stringify(data));
                decoded = true;
            }


        } else if (data[pumpPacketFields.ACTION] == 5) //Set pump mode
        {
            if (!isResponse) {
                if (pumpMessages) console.log('Msg# %s   %s asking %s to set pump mode to _%s_: %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                if (pumpMessages) console.log('Msg# %s   %s confirming it is in mode _%s_: %s', counter, ctrlString[data[pumpPacketFields.FROM]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            }

        } else if (data[pumpPacketFields.ACTION] == 6) //Set run mode
        {
            if (!isResponse) {
                if (pumpMessages) console.log('Msg# %s   %s asking %s to set run to _%s_: %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[pumpPacketFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                if (pumpMessages) console.log('Msg# %s   %s confirming it is in run _%s_: %s', counter, ctrlString[data[pumpPacketFields.FROM]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            }
        } else {
            if (pumpMessages) console.log('Msg# %s is %s', counter, JSON.stringify(data));
            decoded = true;
        }
        instruction = data.slice();
    } else if (((data[packetFields.FROM] == ctrl.REMOTE || data[packetFields.FROM] == ctrl.WIRELESS) && data[packetFields.DEST] == ctrl.MAIN) || ((data[packetFields.DEST] == ctrl.REMOTE || data[packetFields.DEST] == ctrl.WIRELESS) && data[packetFields.FROM] == ctrl.MAIN)) {
        if (data[packetFields.DEST] == 16) {
            var status = {

                source: null,
                destination: null,
                b3: null,
                CMD: null,
                sFeature: null,
                ACTION: null,
                b7: null

            }
            status.source = data[packetFields.FROM]
            status.destination = data[packetFields.DEST]
            status.b3 = data[2] //134... always?
            status.CMD = data[3] == 4 ? 'pool temp' : 'feature'; // either 4=pool temp or 2=feature
            if (data[3] == 2) {
                status.sFeature = circuitArrStr(data[4])
                if (data[5] == 0) {
                    status.ACTION = "off"
                } else if (data[5] == 1) {
                    status.ACTION = "on"
                }
                console.log('Msg# %s   %s asking %s to change _%s %s to %s_ : %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], status.CMD, status.sFeature, status.ACTION, JSON.stringify(data));
                decoded = true;
            } else if (data[3] == 4) {
                status.POOLSETPOINT = data[4];
                status.SPASETPOINT = data[5];
                status.POOLHEATMODE = heatMode[data[6] & 3]; //mask the data[6] with 0011
                status.SPAHEATMODE = heatMode[(data[6] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places
                console.log('Msg# %s   %s asking %s to change pool heat mode to %s (@ %s degrees) % spa heat mode to %s (at %s degrees): %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], status.POOLHEATMODE, status.POOLSETPOINT, status.SPAHEATMODE, status.SPASETPOINT, JSON.stringify(data));
                decoded = true;
            } else if (data[3] == 16) {
                //165, 10, 15, 16, 10, 12, 0, 87, 116, 114, 70, 97, 108, 108, 32, 49, 0, 251, 4, 236
                console.log('12! else: %s', JSON.stringify(data))
                var myString = '';
                for (var i = 0; i < data.length; i++) {
                    myString += String.fromCharCode(data[i])
                }
                console.log('Msg# %s   %s sending %s _%s_ : %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], myString, JSON.stringify(data));
            }
        }
    }
    //in case we get here and the first message has not already been set as the instruction command
    if (instruction == null || instruction == undefined) {
        instruction = data;
    }
    if (!decoded) {
        fulllogger.debug('Msg# %s   Starting to decode message.', counter)
        if (showConsoleNotDecoded) {
            if (data[2] == 32 && data[3] == 11) {
                console.log('*********')
            }
            console.log('Msg# %s is %s', counter, JSON.stringify(data));
            if (data[2] == 32 && data[3] == 11) {
                console.log('*********')
            }
        };
    } else(decoded = false)
    return true; //fix this; turn into callback(?)  What do we want to do with it?
}





//Credit to this function belongs somewhere on Stackoverflow.  Need to find it to give credit.
Object.defineProperty(Object.prototype, "equals", {
    enumerable: false,
    writable: true,
    value: function (object2) {
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
})


//This function adapted from the prototype.equals method above
Object.defineProperty(Object.prototype, "whatsDifferent", {
    enumerable: false,
    writable: true,
    value: function (object2) {
        //For the first loop, we only check for types
        var diffString = '';
        for (propName in this) {
            //Check for inherited methods and properties - like .equals itself
            //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty
            //Return false if the return value is different
            if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
                diffString += ' ' + this.hasOwnProperty(propName);
                //return this.hasOwnProperty(propName);
            }
            //Check instance type
            else if (typeof this[propName] != typeof object2[propName]) {
                //Different types => not equal
                diffString += ' Object type '
                    //return 'Object type';
            }
        }
        //Now a deeper check using other objects property names
        for (propName in object2) {
            //We must check instances anyway, there may be a property that only exists in object2
            //I wonder, if remembering the checked values from the first loop would be faster or not 
            if (this.hasOwnProperty(propName) != object2.hasOwnProperty(propName)) {
                diffString += ' ' + this.hasOwnProperty(propName);
                //return this.hasOwnProperty(propName);
            } else if (typeof this[propName] != typeof object2[propName]) {
                diffString += ' Object type '
                    //return 'Object type';
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
                    diffString += ' '
                propName + ': ' + this[propName] + ' --> ' + object2[propName];
                //return (propName + ': ' + this[propName]);
            } else if (this[propName] instanceof Object && object2[propName] instanceof Object) {
                // recurse into another objects
                //console.log("Recursing to compare ", this[propName],"with",object2[propName], " both named \""+propName+"\"");
                if (!this[propName].equals(object2[propName]))
                    diffString += ' ' + propName + ': ' + this[propName] + ' --> ' + object2[propName]
                    //return (propName + ': ' + this[propName]);
            }
            //Normal value comparison for strings and numbers
            else if (this[propName] != object2[propName]) {
                diffString += ' ' + propName + ': ' + this[propName] + ' --> ' + object2[propName]
                    //return (propName + ': ' + this[propName]);
            }
        }
        if (diffString == '') {
            return 'Nothing!';
        } else {
            return diffString;
        }
    }
});

//Credit for this function belongs to: http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

Object.defineProperty(Object.prototype, "isResponse", {
    enumerable: false,
    writable: true,
    value: function (object2) {

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
});



//<----  START SERVER CODE

// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

app.get('/status', function (req, res) {
    res.send(currentStatus)
})

app.get('/equipment', function (req, res) {
    res.send(poolConfigS)
})



var numUsers = 0;




io.on('connection', function (socket) {

    // when the client emits 'toggleEquipment', this listens and executes
    socket.on('toggleEquipment', function (equipment) {

        console.log('User wants to toggle: ' + equipment); // + ' config: ' + poolConfig.Pentair['9'] + ' or?? ' + poolConfig.Pentair['circuit9'])
        //Msg# 900   Wireless asking Main to change _feature Path Lights to on_ : [16,34,134,2,9,1,1,115]
        //var packet = [00, 255, 165, 16, 34, 134, 2, 9, 1, 1, 115]; //no


        /* var a = (00).toString(16);
         var b = (255).toString(16);
         var c = (165).toString(16);
         var d = (16).toString(16);
         var e = (34).toString(16);
         var f = (134).toString(16);
         var g = (2).toString(16);
         var h = (9).toString(16);
         var i = (1).toString(16);
         var j = (1).toString(16);
         var k = (115).toString(16);
         var packet2 = [a, b, c, d, e, f, g, h, i, j, k];
         var packet3 = [(00).toString(16), (255).toString(16), (165).toString(16), (16).toString(16), (34).toString(16), (134).toString(16), (2).toString(16), (9).toString(16), (1).toString(16), (1).toString(16), (115).toString(16)];  */

        //var packetBuffer = Buffer.from([0x00, 0x255, 0x165, 0x16, 0x34, 0x134, 0x2, 0x9, 0x1, 0x1, 0x115]); //this?
        //var packetBuffer2 = Buffer.from([00, 255, 165, 16, 34, 134, 2, 9, 1, 1, 115]); //or this?
        //var packet4 = [0x00, 0x255, 0x165, 0x16, 0x34, 0x134, 0x2, 0x9, 0x1, 0x1, 0x115];
        sp.write([00, 255, 165, 16, 34, 134, 2, 9, 1, 1, 115], function (err, bytesWritten) {
            sp.drain(function () {
                console.log('Wrote ' + bytesWritten + ' to serial port!!! and error: ' + err)
            });

        })
        console.log('serial port is open?: ', sp.isOpen());
        /*
                 sp.write([00, 255, 165, 16, 34, 134, 2, 9, 1, 1, 115], function (err) {
                         if (err) {console.log('error writing to port: ', err.message);
                     }
                     console.log('message written x2');
                 });
        */

        //   sp.close();
        //sp.open();

    });

    socket.on('search', function (mode, src, dest, action) {
        //check if we don't have all valid values, and then emit a message to correct.

        console.log('from socket.on search: mode: %s  src %s  dest %s  action %s', mode, src, dest, action);
        searchMode = mode;
        searchSrc = src;
        searchDest = dest;
        searchAction = action;
    })

    //if client connects immediately, currentstatus will not be available and client may crash
    //var tempStatus = '';
    //if (!currentStatus) tempStatus = 
    io.sockets.emit('status',
        currentStatus
    );

    io.sockets.emit('searchResults',
        'Input values and click start.  All values optional.  Please refer to <a href="https://github.com/tagyoureit/nodejs-Pentair/wiki/Broadcast>Github nodejs-Pentair Wiki</a> for values.');
});

//---->  END SERVER CODE