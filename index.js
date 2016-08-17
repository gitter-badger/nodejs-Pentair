(function () {
    'use strict';
    // this function is strict...
}());

console.log('\033[2J'); //clear the console

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
var currentCircuitArrObj; //persistent variable to hold circuit info
var instruction = ''; //var to hold potential chatter instructions
var processingBuffer = 0; //flag to tell us if we are processing the buffer currently
var msgCounter = 0; //log counter to help match messages with buffer in log


//To do: Clean up the following... consolidate or at least make it consistent
var loglevel = 0; //1=more, 0=less
var pumpMessages = 0; //variable if we want to output pump messages or not
var duplicateMessages = 0; //variable if we want to output duplicate broadcast messages
var showConsoleNotDecoded = 1; //variable to hide any unknown messages
var showConfigMessages = 1; //variable to show/hide configuration messages

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


// this first four bytes of ANY packet are the same
const packetFields = {
    DEST: 0,
    FROM: 1,
    ACTION: 2,
    LENGTH: 3,

}

const controllerStatusPacketFields = {
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
    HEATER_MODE: 26
}

const pumpPacketFields = {
    //DEST: 0,  -- same as packetFields (common)
    //FROM: 1,
    //ACTION: 2,
    //LENGTH: 3,
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

const namePacketFields = {
    NUMBER: 4,
    CIRCUITFUNCTION: 5,
    NAME: 6,
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

const strActions = {
    1: 'Ack Message',
    2: 'Controller Status',
    5: 'Date/Time',
    7: 'Pump Status',
    8: 'Heat/Temperature Status',
    10: 'Custom Names',
    11: 'Circuit Names/Function',
    16: 'Heat Pump Status?',
    17: 'Schedule details',
    19: 'IntelliChem pH',
    23: 'Pump Status',
    24: 'Pump Config',
    25: 'IntelliChlor Status',
    29: 'Valve Status',
    34: 'Solar/Heat Pump Status',
    35: 'Delay Status',
    39: 'Set ?',
    40: 'Settings?',

    133: 'Set Date/Time',
    134: 'Set Circuit',
    136: 'Set Heat/Temperature',
    138: 'Set Custom Name',
    139: 'Set Circuit Name/Function',
    144: 'Set Heat Pump',
    147: 'Set IntelliChem',
    152: 'Set Pump Config',
    153: 'Set IntelliChlor',
    157: 'Set Valves',
    162: 'Set Solar/Heat Pump',
    163: 'Set Delay',

    197: 'Get Date/Time',
    200: 'Get Heat/Temperature',
    202: 'Get Custom Name',
    203: 'Get Circuit Name/Function',
    208: 'Get Heat Pump',
    209: 'Get Schedule',
    211: 'Get IntelliChem',
    215: 'Get Pump Status',
    216: 'Get Pump Config',
    217: 'Get IntelliChlor',
    221: 'Get Valves',
    226: 'Get Solar/Heat Pump',
    227: 'Get Delays',
    231: 'Get ?',
    232: 'Get Settings?',

    252: 'SW Version Info',
    253: 'Get SW Version',
}


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




//New Objects to replace arrays
function circuit(number, numberStr, name, circuitFunction, status, freeze) {
    this.number = number; //1
    this.numberStr = numberStr; //circuit1
    this.name = name; //Pool
    this.circuitFunction = circuitFunction; //Generic, Light, etc
    this.status = status; //On, Off
    this.freeze = freeze; //On, Off
}
var circuit1 = new circuit();
var circuit2 = new circuit();
var circuit3 = new circuit();
var circuit4 = new circuit();
var circuit5 = new circuit();
var circuit6 = new circuit();
var circuit7 = new circuit();
var circuit8 = new circuit();
var circuit9 = new circuit();
var circuit10 = new circuit();
var circuit11 = new circuit();
var circuit12 = new circuit();
var circuit13 = new circuit();
var circuit14 = new circuit();
var circuit15 = new circuit();
var circuit16 = new circuit();
var circuit17 = new circuit();
var circuit18 = new circuit();
var circuit19 = new circuit();
var circuit20 = new circuit();


var currentCircuitArrObj = ['blank', circuit1, circuit2, circuit3, circuit4, circuit5, circuit6, circuit7, circuit8, circuit9, circuit10, circuit11, circuit12, circuit13, circuit14, circuit15, circuit16, circuit17, circuit18, circuit19, circuit20];



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
console.log('\n Configuration is now read from your pool.  The application will send the commands to retrieve the custom names and circuit names.');
console.log('\n It may take up to a minute for the UI in the below URL to properly show.  Please be patient');
console.log('\n Visit http://_your_machine_name_:3000 to see a basic UI');
console.log('\n Visit http://_your_machine_name_:3000/debug.html for a way to listen for specific messages\n\n');
console.log('*******************************')


var queuePacketsArr = []; //array to hold messages to send



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
    if (loglevel) console.log('Queueing messages to retrieve Custome Names and Circuit Names');

    getConfiguration();
    if (loglevel) console.log('Done queueing messages to retrieve Custom Names and Circuit Names')

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
        if (currBufferLen > 10 && !processingBuffer) {

            //do we still need this?
            //processingBuffer = 1;


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
                                fulllogger.log('silly', 'Msg#  n/a   BUFFER IN MSG CHECK:  data2.len %s, chatterlen %s, i %s: TOTAL: %s True? %s ', data2.length, chatterlen, i, data2.length - i - 1 - chatterlen, (data2.length - i - 2 - chatterlen) <= 0)





                                if (chatterlen == undefined || (data2.length - i - 2 - chatterlen) <= 0) {
                                    //reset the buffer starting with the current partial message
                                    fulllogger.debug('Msg#  n/a   Incomplete message at end of buffer.  Prepending message to empty buffer string.');
                                    brokeBufferLoop = true;

                                    data2 = data2.slice(i - 2)
                                    break loop1;
                                }

                                msgCounter += 1;
                                //fulllogger.info('Msg# %s   Full buffer where message found: %s', msgCounter, b.data.toString())

                                i += 3; //jump ahead to start of payload


                                fulllogger.silly('Msg#  %s   Length should be: %s  at position: %s ', msgCounter, chatterlen, i)


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
                                            fulllogger.silly('Msg# %s   Extracting chatter from buffer: (length of chatter %s, position in buffer %s, start position of chatter in buffer %s) %s', msgCounter, chatterlen, i, j, output)

                                            //This may be unnecessary; fixed code so we should get correct messages but will leave it for now
                                            if (chatter[j] == undefined || chatter[j - 1] == undefined || chatter[j - 1] == undefined) {
                                                fulllogger.warn('Msg# %s   Chatter length MISMATCH.  len %s, i %s currBufferLen %s', msgCounter, chatterlen, i, currBufferLen)
                                            }

                                            if (loglevel == 1) console.log('Msg# %s Calling checksum: %s %s', msgCounter, chatter, msgCounter);
                                            checksum(chatter, msgCounter);
                                            //skip ahead in the buffer for loop to the end of this message. 
                                            i += chatterlen;
                                            break loop1;
                                        }


                                    }
                                }


                            }
                            /* //this isn't working <-- CHECK
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
                                         checksum(chatter);
                                         //skip ahead in the buffer for loop to the end of this message. 
                                         i += chatterlen;
                                         console.log('<-----FOUND SOMETHING???')
                                         break loop1;
                                     }


                                 }

                             }*/

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
function checksum(chatterdata, counter) {

    //make a copy so when we callback the decode method it isn't changing our log output in Winston
    if (loglevel == 1)("Msg# %s   Checking checksum on chatter: ", chatterdata);
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

        //if a mismatch, rewrite the packet in case it was from us.
        if (queuePacketsArr.length > 0) {
            writePacket();
        }
    } else {
        logger.info('Msg# %s   Match on Checksum:    %s==%s   %s', counter, chatterdatachecksum, databytes, chatterCopy)
    }

    //Go back to working on the original, not the copy
    //now that we calculated checksum, strip leading 165 and 10 as it is extraneous

    chatterCopy = chatterCopy.splice(2);
    //console.log("NewCD: ", newcd);
    fulllogger.silly("Msg# %s   Chatterdata splice: %s --> %s ", counter, chatterdata, chatterCopy)
        //call new function to process message; if it isn't valid, we noted above so just don't continue
    if (validChatter) {
        if (queuePacketsArr.length > 0) {
            isResponse(chatterCopy, counter)
        } else {
            decode(chatterCopy, counter)
        }
    }
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









function decode(data, counter, responseBool) {
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



    //I believe this should be any packet with 165,10.  Need to verify.
    if ((data[packetFields.DEST] == ctrl.BROADCAST) || (data[packetFields.DEST] == ctrl.MAIN) || (data[packetFields.DEST] == ctrl.WIRELESS) || (data[packetFields.DEST] == ctrl.REMOTE)) {
        switch (data[packetFields.ACTION]) {

        case 2: //Controller Status 
            {

                //status will be our return object
                var status = {};

                //time returned in HH:MM (24 hour)  <-- need to clean this up so we don't get times like 5:3
                status.time = data[controllerStatusPacketFields.HOUR] + ':' + data[controllerStatusPacketFields.MIN];
                status.waterTemp = data[controllerStatusPacketFields.WATER_TEMP];
                status.temp2 = data[controllerStatusPacketFields.TEMP_2];
                status.airTemp = data[controllerStatusPacketFields.AIR_TEMP];
                status.solarTemp = data[controllerStatusPacketFields.SOLAR_TEMP];
                status.poolHeatMode = heatMode[data[controllerStatusPacketFields.UNKNOWN] & 3]; //mask the data[6] with 0011
                status.spaHeatMode = heatMode[(data[controllerStatusPacketFields.UNKNOWN] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places

                status.poolHeatMode2 = heatMode[data[controllerStatusPacketFields.HEATER_MODE] & 3]; //mask the data[6] with 0011
                status.spaHeatMode2 = heatMode[(data[controllerStatusPacketFields.HEATER_MODE] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places

                status.valves = strValves[data[controllerStatusPacketFields.VALVES]];
                status.runmode = strRunMode[data[controllerStatusPacketFields.UOM] & 129]; // more here?
                status.UOM = String.fromCharCode(176) + ((data[controllerStatusPacketFields.UOM] & 4) >> 3) ? ' Farenheit' : ' Celsius';
                if (data[controllerStatusPacketFields.HEATER_ACTIVE] == 0) {
                    status.HEATER_ACTIVE = 'Off'
                } else
                if (data[controllerStatusPacketFields.HEATER_ACTIVE] == 32) {
                    status.HEATER_ACTIVE = 'Heater On'
                } else {
                    status.HEATER_ACTIVE = 'Unknown'
                };





                //Initialize static variable (currentStatus) if not defined, and log it.
                if (currentStatus == null || currentStatus == undefined) {
                    currentStatus = clone(status);
                    currentStatusBytes = data.slice(0);
                    console.log('-->INITIAL EQUIPMENT Msg# %s   \n', counter)
                    logger.info('Msg# %s   Discovered initial pool settings: %s', counter, JSON.stringify(currentStatus))
                    console.log(printStatus(data));
                    //console.log(circuitArrObj)




                    //Loop through the three bits that start at 3rd (and 4th/5th) bit in the data payload
                    for (var i = 0; i < circuitArr.length; i++) {
                        //loop through all physical circuits within each of the bits
                        for (j = 0; j < circuitArr[i].length; j++) {
                            var tempFeature = circuitArr[i][j]; //name of circuit
                            equip = data[controllerStatusPacketFields.EQUIP1 + i]
                            currentCircuitArrObj[j + (i * 8) + 1].status = (equip & (1 << (j))) >> j ? "on" : "off"
                        }



                    }
                    console.log('Initial circuits: %s', JSON.stringify(currentCircuitArrObj))
                    console.log('\n <-- EQUIPMENT \n');
                    io.sockets.emit('status',
                        currentCircuitArrObj
                    )



                } else {

                    //Check if we have the same data
                    /*console.log('\n*******EQUIPMENT STATUS !status.equals(currentStatus): %s', !status.equals(currentStatus))
                    console.log('status: %s', JSON.stringify(status))
                    console.log('currentStatus: %s', JSON.stringify(currentStatus))
                    console.log('*******\n')*/

                    //if (!status.equals(currentStatus)) {

                    if (!data.equals(currentStatusBytes)) {

                        //console.log('EQUIPMENT STATUS UNEQUAL')


                        //we are only checking our KNOWN objects.  There may be other differences and we'll recode for that shortly.
                        //Loop through the three bits that start at 3rd (and 4th/5th) bit in the data payload




                        //the following is a shortcut for reassiging the whole array.  It will be overwritten below.  
                        //var circuitArrObj = JSON.parse(JSON.stringify(circuitArrObj));

                        var circuitArrObj = ['blank', circuit1, circuit2, circuit3, circuit4, circuit5, circuit6, circuit7, circuit8, circuit9, circuit10, circuit11, circuit12, circuit13, circuit14, circuit15, circuit16, circuit17, circuit18, circuit19, circuit20];


                        for (var i = 0; i < circuitArr.length; i++) {
                            //loop through all physical circuits within each of the bits
                            for (j = 0; j < circuitArr[i].length; j++) {
                                var tempFeature = circuitArr[i][j]; //name of circuit
                                equip = data[controllerStatusPacketFields.EQUIP1 + i]

                                //status[tempFeature] = (equip & (1 << (j))) >> j ? "on" : "off"

                                //debug messages
                                //console.log('length circuitarr.len: %s   circuitarr[i].len: %s   \n  circuitArr: %s', circuitArr.length, circuitArr[i].length, circuitArr.join('],\n['))
                                //console.log('status[%s][%s] = ', i,j, status[tempFeature])
                                //console.log('update status on CircuitArrObj[%s](%s) to %s',j + (i * 8) + 1,circuitArrObj[j + (i * 8) + 1].name,(equip & (1 << (j))) >> j ? "on" : "off")


                                circuitArrObj[j + (i * 8) + 1].status = (equip & (1 << (j))) >> j ? "on" : "off"
                            }
                        }


                        console.log('-->EQUIPMENT Msg# %s   \n', counter)
                        currentWhatsDifferent = currentStatus.whatsDifferent(status);
                        console.log('Msg# %s   What\'s Different System Status?: %s', counter, currentWhatsDifferent)
                        console.log('Msg# %s   What\'s Different with Circuits? (Need to fix): %s', counter, currentCircuitArrObj.whatsDifferent(circuitArrObj))



                        console.log(printStatus(currentStatusBytes, data));
                        //console.log(circuitArrObj);
                        console.log('<-- EQUIPMENT \n');


                        currentStatus = clone(status);
                        currentStatusBytes = data.slice(0);
                        currentCircuitArrObj = JSON.parse(JSON.stringify(circuitArrObj));
                        decoded = true;
                        io.sockets.emit('status',
                            currentCircuitArrObj
                        )

                    } else {


                        if (duplicateMessages) console.log('Msg# %s   Duplicate broadcast.', counter)
                        decoded = true;


                    }

                }


                decoded = true;
                break;
            }



        case 10: //Get Custom Names
            {
                //console.log('CUSTOM NAME')

                var customName = '';
                for (var i = 5; i < 16; i++) {
                    if (data[i] > 0 && data[i] < 251) //251 is used to terminate the custom name string if shorter than 11 digits
                    {
                        //console.log('i: %s and data[i]: %s',i, data[i])
                        customName += String.fromCharCode(data[i])
                    };
                }

                if (loglevel == 1) console.log('Msg# %s  Custom Circuit Name Raw:  %s  & Decoded: %s', counter, JSON.stringify(data), customName)
                if (showConfigMessages) {

                    console.log('Msg# %s  Custom Circuit Name Decoded: "%s"', counter, customName)
                }
                //push method works because the names are output in orde.

                customNameArr[data[4]] = customName;

                //display custom names when we reach the last circuit
                if (data[4] == 9) {
                    console.log('\nCustom Circuit Names retrieved from configuration: \n [%s]\n ', customNameArr)
                }
                if (loglevel == 1) console.log(customNameArr)

                //parseInt(n,16).toString(2)
                io.sockets.emit('status',
                    currentCircuitArrObj
                )
                decoded = true;
                break;
            }

        case 11: // Get Circuit Names
            {


                var whichCircuit = 0;
                if (data[namePacketFields.NUMBER] <= 8) {
                    whichCircuit = 0; //8 bits for first mode byte
                } else if (data[namePacketFields.NUMBER] > 8 && data[namePacketFields.NUMBER] <= 16) {
                    (whichCircuit = 1) //8 bits for 2nd mode byte
                } else(whichCircuit = 2); //8 bits for 3rd mode byte

                var freezeProtection;
                if ((data[namePacketFields.CIRCUITFUNCTION] & 64) == 64) {
                    freezeProtection = 'on'
                } else {
                    freezeProtection = 'off'
                }
                //The &63 masks to 00111111 because 01000000 is freeze protection bit
                if (showConfigMessages) {
                    fulllogger.silly('Msg# %s  Circuit Info  %s', counter, JSON.stringify(data))

                    //if (showConfigMessages == 1) console.log('Msg# %s  Schedule Discovered.  CIRCUIT NUMBER: %s  CIRCUIT NAME: %s(%s)  CIRCUIT FUNCTION: %s(%s, %s)  FREEZE PROTECTION: %s(masked:%s)', counter, data[namePacketFields.NUMBER], strCircuitName[data[namePacketFields.NAME]], data[namePacketFields.NAME], strCircuitFunction[data[namePacketFields.CIRCUITFUNCTION] & 63], data[namePacketFields.CIRCUITFUNCTION], data[namePacketFields.CIRCUITFUNCTION] & 63, freezeProtection, data[namePacketFields.CIRCUITFUNCTION] & 64)


                    if (showConfigMessages == 1) console.log('Msg# %s  Schedule %s:  Circuit Name: %s  Function: %s  Freeze Protection: %s', counter, data[namePacketFields.NUMBER], strCircuitName[data[namePacketFields.NAME]], strCircuitFunction[data[namePacketFields.CIRCUITFUNCTION] & 63], freezeProtection)
                }


                //if the ID of the circuit name is 1-101 then it is a standard name.  If it is 200-209 it is a custom name.  The mapping between the string value in the getCircuitNames and getCustomNames is 200.  So subtract 200 from the circuit name to get the id in the custom name array.
                //data[4]-1 because this array starts at 1 and JS arrays start at 0.
                //-(8*whichCircuit) because this will subtract 0, 8 or 16 from the index so each secondary index will start at 0

                //array
                if (data[namePacketFields.NAME] < 200) {
                    circuitArr[whichCircuit][data[namePacketFields.NUMBER] - (8 * whichCircuit) - 1] = strCircuitName[data[namePacketFields.NAME]];
                } else {
                    if (showConfigMessages) console.log('mapping %s to %s', strCircuitName[data[namePacketFields.NAME]], customNameArr[data[namePacketFields.NAME] - 200]);
                    circuitArr[whichCircuit][data[namePacketFields.NUMBER] - (8 * whichCircuit) - 1] = customNameArr[data[namePacketFields.NAME] - 200];
                }

                if (loglevel) console.log('circuit name for %s: %s', data[namePacketFields.NUMBER], strCircuitName[data[namePacketFields.NAME]])

                //arrayObj
                if (data[namePacketFields.NUMBER] != null) { //|| data[namePacketFields.NUMBER] != undefined) {
                    if (data[namePacketFields.NAME] < 200) {
                        currentCircuitArrObj[data[namePacketFields.NUMBER]].name = strCircuitName[data[namePacketFields.NAME]]
                    } else {
                        currentCircuitArrObj[data[namePacketFields.NUMBER]].name = customNameArr[data[namePacketFields.NAME] - 200];
                    }
                    currentCircuitArrObj[data[namePacketFields.NUMBER]].number = data[namePacketFields.NUMBER];
                    currentCircuitArrObj[data[namePacketFields.NUMBER]].numberStr = 'circuit' + data[namePacketFields.NUMBER];
                    currentCircuitArrObj[data[namePacketFields.NUMBER]].circuitFunction = strCircuitFunction[data[namePacketFields.CIRCUITFUNCTION] & 63];
                    currentCircuitArrObj[data[namePacketFields.NUMBER]].freeze = freezeProtection;
                }

                if (loglevel == 1) console.log('currentCircuitArrObj[%s]: %s ', data[namePacketFields.NUMBER], JSON.stringify(currentCircuitArrObj[data[namePacketFields.NUMBER]]))




                if (data[namePacketFields.NUMBER] == 20) console.log('Circuit Array Discovered from configuration: \n[[%s]]\n', circuitArr.join('],\n['))

                io.sockets.emit('status',
                    currentCircuitArrObj
                )

                decoded = true;
                break;
            }

        case 17: // Get Schedules
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
                decoded = true;
                break;
            }
            //Set Circuit Function On/Off
        case 134:
            {

                if (data[packetFields.DEST] == ctrl.MAIN) {
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
                        break;
                    }



                }
            }
        case 136:
            {

                if (data[packetFields.DEST] == ctrl.MAIN) {
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




                    if (data[3] == 4) {
                        status.POOLSETPOINT = data[4];
                        status.SPASETPOINT = data[5];
                        status.POOLHEATMODE = heatMode[data[6] & 3]; //mask the data[6] with 0011
                        status.SPAHEATMODE = heatMode[(data[6] & 12) >> 2]; //mask the data[6] with 1100 and shift right two places
                        console.log('Msg# %s   %s asking %s to change pool heat mode to %s (@ %s degrees) % spa heat mode to %s (at %s degrees): %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], status.POOLHEATMODE, status.POOLSETPOINT, status.SPAHEATMODE, status.SPASETPOINT, JSON.stringify(data));

                        decoded = true;
                        break;
                    }



                }
            }
        default:
            {
                if (loglevel == 1) {
                    var currentAction = strActions[data[packetFields.ACTION]]
                    if (currentAction != undefined) {
                        console.log('Msg# %s %s packet: %s', counter, currentAction, data)
                        decoded = true;
                    } else {
                        console.log(('Msg# %s is NOT DEFINED packet: %s', counter, data))
                    }
                }
                decoded = true;
            }


        }

    }

    //I believe this should be any packet with 165,0.  Need to verify.
    if (((data[packetFields.FROM] == ctrl.PUMP1 || data[packetFields.FROM] == ctrl.PUMP2)) || data[packetFields.DEST] == ctrl.PUMP1 || data[packetFields.DEST] == ctrl.PUMP2)

    {
        if (pumpMessages == 1) console.log('Decoding pump packet %s', data)
        if (instruction == null || instruction == undefined || instruction == '') {
            instruction = data;
            if (loglevel == 1) console.log('Msg# %s   Setting initial chatter as instruction: %s', counter, instruction)
        }

        //var isResponse = data.isResponse(instruction);
        var ctrlType = data2;

        //Send request/response for pump status
        if (data[packetFields.ACTION] == 7) {
            if (data[packetFields.CMD] == 1) //Request pump status
            {
                if (pumpMessages) console.log('Msg# %s   Main asking %s for status: %s', counter, ctrlString[data[packetFields.DEST]], JSON.stringify(data));
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

                var pumpnum = (data[packetFields.FROM]).toString();
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

        if (data[packetFields.ACTION] == 4) //Pump control panel on/off
        {
            if (data[pumpPacketFields.CMD] == 255) //Set pump control panel off (Main panel control only)
            {
                if (!responseBool) {
                    if (pumpMessages) console.log('Msg# %s   %s asking %s for remote control (turn off pump control panel): %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], JSON.stringify(data));
                    decoded = true;
                } else {
                    if (pumpMessages) console.log('Msg# %s   %s confirming it is in remote control: %s', counter, ctrlString[data[packetFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
            if (data[pumpPacketFields.CMD] == 0) //Set pump control panel on 
            {
                if (!responseBool) {
                    if (pumpMessages) console.log('Msg# %s   %s asking %s for local control (turn on pump control panel): %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], JSON.stringify(data))
                    decoded = true;
                } else {
                    if (pumpMessages) console.log('Msg# %s   %s confirming it is in local control: %s', counter, ctrlString[data[packetFields.FROM]], JSON.stringify(data))
                    decoded = true;
                }
            }
        } else if (data[packetFields.ACTION] == 1) //Write command to pump
        {
            if (data[pumpPacketFields.LENGTH] == 4) //This might be the only packet where isResponse() won't work because the pump sends back a validation command
            {
                var pumpCommand = '';
                for (var i = 1; i < data[packetFields.LENGTH]; i++) {
                    pumpCommand += data[i + packetFields.LENGTH] //Not sure if it is a coincidence that pumpPacketFields.LENGTH ==4, but the 4th byte is the start of the message.
                    pumpCommand += ', '
                }

                if (pumpMessages) console.log('Msg# %s   %s asking %s to write a _%s_ command: %s', counter, ctrlString[data[pumpPacketFields.FROM]], ctrlString[data[packetFields.DEST]], pumpCommand, JSON.stringify(data));
                decoded = true;
            } else {
                var pumpResponse = ''
                pumpResponse += data[pumpPacketFields.LENGTH + 1] + ', ' + data[pumpPacketFields.LENGTH + 2]
                if (pumpMessages) console.log('Msg# %s   %s sent response _%s_ to write command: %s', counter, ctrlString[data[packetFields.FROM]], pumpResponse, JSON.stringify(data));
                decoded = true;
            }


        } else if (data[packetFields.ACTION] == 5) //Set pump mode
        {
            if (!responseBool) {
                if (pumpMessages) console.log('Msg# %s   %s asking %s to set pump mode to _%s_: %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                if (pumpMessages) console.log('Msg# %s   %s confirming it is in mode _%s_: %s', counter, ctrlString[data[packetFields.FROM]], data[packetFields.CMD], JSON.stringify(data));
                decoded = true;
            }

        } else if (data[packetFields.ACTION] == 6) //Set run mode
        {
            if (!responseBool) {
                if (pumpMessages) console.log('Msg# %s   %s asking %s to set run to _%s_: %s', counter, ctrlString[data[packetFields.FROM]], ctrlString[data[packetFields.DEST]], data[packetFields.CMD], JSON.stringify(data));
                decoded = true;
            } else {
                if (pumpMessages) console.log('Msg# %s   %s confirming it is in run _%s_: %s', counter, ctrlString[data[packetFields.FROM]], data[pumpPacketFields.CMD], JSON.stringify(data));
                decoded = true;
            }
        } else {
            if (pumpMessages) console.log('Msg# %s is %s', counter, JSON.stringify(data));
            decoded = true;
        }
        instruction = data.slice();
    }




    //in case we get here and the first message has not already been set as the instruction command
    if (instruction == null || instruction == undefined) {
        instruction = data;
    }
    if (!decoded) {
        if (showConsoleNotDecoded) {

            console.log('Msg# %s is NOT DECODED %s', counter, JSON.stringify(data));

        };
    } else(decoded = false)
    return true; //fix this; turn into callback(?)  What do we want to do with it?
}



//this function is the "broker" between the receiving workflow and the sending workflow
function isResponse(chatter, counter) {

    if (loglevel == 1) console.log('Enterning isResponse: %s %s', chatter, counter)

    //make copies of the object so we assign the variables by value and not change the originals (by reference)
    //need to use the clone function because slice doesn't work on objects for by value copy
    tempObj = clone(chatter);

    objSrc = this[packetFields.FROM];
    objDest = this[packetFields.DEST];
    tempObj[packetFields.DEST] = objSrc;
    tempObj[packetFields.FROM] = objDest;


    if (loglevel == 1) {
        console.log('queuePacketsArr.length: %s   tempObj.equals(chatter): %s ', queuePacketsArr.length, tempObj.equals(chatter))
    }


    //For Broadcast Packets
    //Ex set circuit name[255,0,255,165, 10, 16, 32, 139, 5, 7, 0, 7, 0, 0, 1, 125]
    //Ex ACK circuit name[165,10,15,16,10,12,0,85,83,69,82,78,65,77,69,45,48,49]  

    //console.log('Msg#: %s chatter: %s chatterreceived.action: %s (1??)  chatterreceieved.4: %s == queue[0].action: %s ALL TRUE?  %s ', counter, chatter, chatter[packetFields.ACTION], chatter[4], queuePacketsArr[0][7], ((chatter[packetFields.ACTION] == 1) && (chatter[4] == queuePacketsArr[0][7])))

    //...OR.... check for bitwise isResponse

    if (loglevel == 1) console.log('Msg#: %s  chatterreceived.action: %s (10?) == queue[0].action&63: %s ALL TRUE?  %s \n\n', counter, chatter[packetFields.ACTION], queuePacketsArr[0][7] & 63, ((chatter[packetFields.ACTION] == (queuePacketsArr[0][7] & 63))))



    if (queuePacketsArr.length > 0) {
        //If an ACK
        if (chatter[packetFields.ACTION] == 1 && chatter[4] == queuePacketsArr[0][7]) {
            successfulAck(true, counter);
            decode(chatter, counter, true);
        }
        //If a broadcast response to request 202 --> 10
        else if ((chatter[packetFields.ACTION] == (queuePacketsArr[0][7] & 63))) {

            successfulAck(true, counter);
            decode(chatter, counter, true);
        }
    }
    //This is for pump messages.  Messages will be exactly the same exact dest/src will be swapped.
    if (tempObj.equals(chatter)) {
        if (queuePacketsArr.length > 0) {
            successfulAck(false, counter, chatter)
        }
        decode(chatter, counter, true)
    } else
    if (queuePacketsArr.length > 0) {
        successfulAck(false, counter, chatter)
    } else {
        decode(chatter, counter, false)
            //console.log('Msg#: %s In isResponse -- Not a. %s', counter, chatter)
    }

};



//------------------START WRITE SECTION


function successfulAck(messageAck, counter, chatter) {
    fulllogger.silly('Msg#: in successfulAck  messageAck: %s counter: %s  packetWrittenAt: %s  queuePacketsArr.length: %s', counter, messageAck, counter, packetWrittenAt, queuePacketsArr.length)
    if (loglevel == 1) console.log('Msg# %s  Comparing Message received:  %s to message written: %s', counter, chatter, queuePacketsArr[0])
    if (messageAck == true) {
        queuePacketsArr.shift();

        //Only call writePacket if there are more instructions to write to the serial bus
        if (queuePacketsArr.length > 0) {
            writePacket()
        };
    } else {

        if (queuePacketsArr.length > 1) {
            //console.log('****HOW MANY RETRIES:  counter: %s   packetwrittenAt: %s  diff: %s', counter, packetWrittenAt, counter-                packetWrittenAt)
            //what is the best way to send messages again?
            if (counter - packetWrittenAt > 5) {

                //retry same packet
                writePacket();
            }
        }
    }
}

function queuePacket(message) {


    //Process the packet to include the preamble and checksum

    var packet = [255, 0, 255];
    //var pumpPacket = [165, 10, 16, 34, 136, 4, 88, 0, 3, 0, ]
    var checksum = 0;
    for (var j = 0; j < message.length; j++) {
        checksum += message[j]
    }
    message.push(checksum >> 8)
    message.push(checksum & 0xFF)

    Array.prototype.push.apply(packet, message);


    //-------Internally validate checksum

    //example packet: 255,0,255,165,10,16,34,2,1,0,0,228
    var len = packet.length;

    //checksum is calculated by 256*2nd to last bit + last bit 
    var packetchecksum = (packet[len - 2] * 256) + packet[len - 1];
    var databytes = 0;

    // add up the data in the payload
    for (var i = 3; i < len - 2; i++) {
        databytes += packet[i];
    }
    var validPacket = (packetchecksum == databytes);
    if (!validPacket) {
        console.log('***Asking to queue malformed packet: %s', packet)
    } else {
        queuePacketsArr.push(packet);
        console.log('Just Queued Message to send: %s', packet)
    }


    //-------End Internally validate checksum






    fulllogger.silly('after push packet: %s  Message: %s', packet, message)

    //if length > 0 then we will loop through from isResponse
    if (queuePacketsArr.length == 1)
        writePacket();




}

var packetWrittenAt; //var to hold the message counter variable when the message was sent.  Used to keep track of how many messages passed without a successful counter.

function writePacket() {
    fulllogger.silly('Entering Write Queue')


    console.log('Sending packet: %s', queuePacketsArr[0])
    sp.write(queuePacketsArr[0], function (err, bytesWritten) {
        sp.drain(function () {
            if (loglevel == 1) console.log('Wrote ' + queuePacketsArr[0] + ' and # of bytes ' + bytesWritten + ' Error?: ' + err)
        });

    })
    packetWrittenAt = msgCounter;


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
        //If everything passed, let's say TRUE
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



function getConfiguration(callback) {
    sp.drain();




    var i = 0;
    for (i; i < 10; i++) {

        //writePacket([165, 10, 16, 34, 202, 1, i]) 
        queuePacket([165, 10, 16, 34, 202, 1, i]);


    }
    for (i = 1; i < 21; i++) {

        //writePacket([165, 10, 16, 34, 203, 1, i])
        queuePacket([165, 10, 16, 34, 203, 1, i]);

    }



}




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

        //console.log('User wants to toggle: %s. %s', equipment, JSON.stringify(equipment));



        //var packet = [255, 0, 255];
        var desiredStatus = currentCircuitArrObj[equipment].status == "on" ? 0 : 1;
        var checksum = 0;
        var toggleCircuitPacket = [165, 10, 16, 34, 134, 2, equipment, desiredStatus];
        /*for (var j = 0; j < toggleCircuitPacket.length; j++) {
            checksum += toggleCircuitPacket[j]
        }
        toggleCircuitPacket.push(checksum >> 8)
        toggleCircuitPacket.push(checksum & 0xFF)*/
        //Array.prototype.push.apply(packet, toggleCircuitPacket);

        //Push packet to beginning of input because there is no local echo.
        //const buf1 = Buffer.from(packet);
        //data2 = Buffer.concat([buf1, data2]);

        queuePacket(toggleCircuitPacket);
        /*sp.write(packet, function (err, bytesWritten) {
            sp.drain(function () {
                if (err) {
                    console.log('Error (%s) writing packet: %s', err, packet)
                } else
                    console.log('Wrote ' + packet + ' and bytes ' + bytesWritten)
            });

        })*/


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
        currentCircuitArrObj
    );

    io.sockets.emit('searchResults',
        'Input values and click start.  All values optional.  Please refer to <a href="https://github.com/tagyoureit/nodejs-Pentair/wiki/Broadcast>Github nodejs-Pentair Wiki</a> for values.');
});

//---->  END SERVER CODE