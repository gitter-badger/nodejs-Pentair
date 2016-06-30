# nodejs-Pentair

This is a set of test code to read the Pentair system messages off of the RS-485 serial bus.  

This code will hopefully build upon the work of others in understanding the protocol and enable stand-alone control or inclusion in a home automation project.  I personally want to use this to create another module for the [HomeBridge page](https://github.com/nfarina/homebridge) (Apple Homekit integration for the impatient).

See credits below as many have done great work before me.

My goals of this project are:
1.  Understand the messages on the bus.  There are many that are understood, but even more that are still a mystery.
2.  Build code that can be used as a plug-in (phase II)
3.  Build this in such a way that it can work with any pool setup.

Let me elaborate on #3.  Both the awesome work of Jason Y and Michael were specific to their pool (I didn't even look closely at the #2 Credit code because it was in C).  


# Installation

1. This code **REQUIRES** a RS485 serial module.  There are plenty of sites out there that describe the RS485 and differences from RS232 so I won't go into detail here.  I purchased [EZSync FTDI](http://www.amazon.com/EZSync-RS485-USB-RS485-WE-compatible-EZSync010/dp/B010KJSCR8?ie=UTF8&psc=1&redirect=true&ref_=oh_aui_detailpage_o01_s00) but I think others will do
2.  I will add more later about the actual wiring of the adapter, but I used the Ground<--> Ground, and the DATA+ and DATA- (no power needed as your Pentair adapters already are powered and so is my RS-485 adapter.
3.  To see if you are getting the proper communications from the bus, before you even try to run this program, run from your *nix command line ```od -x < /dev/ttyUSB0```.  Of course, you'll need to change the address of your RS-485 adapter if it isn't the same as mine (here and in the code).
⋅⋅3a   You'll know you have the wires write when the output of this command looks like (you should see multiple repititions of ffa5ff): 
```
0002240 0000 0000 0000 0000 0000 ff00 ffff ffff
0002260 *ffff 00ff a5ff* 0f0a 0210 161d 000c 0040
0002300 0000 0000 0300 4000 5004 2050 3c00 0039
0002320 0400 0000 597a 0d00 af03 00ff a5ff 100a
0002340 e722 0001 c901 ffff ffff ffff ffff ff00
```
⋅⋅3b.  This is the WRONG wiring (no ffa5ff present).
```
0001440 0000 0000 0000 0000 0000 0000 0000 6a01
0001460 e1d6 fbdf d3c5 fff3 ff7f ffff ffff f9ff
0001500 7fff 5ff7 bf5f 87ff ff8d f7ff ffff 4d0b
0001520 e5ff adf9 0000 0000 0000 0000 0100 d66a
0001540 dfe1 c5fb f3d3 7fff ffff ffff ffff fff9
```

# Versions
Initial - This version was the first cut at the code

0.0.2 - Many, many improvements.  
    - No duplicate messages!  I realized the way my code was running that I was parsing the same message multiple times.  The code now slices the buffer after each message that is parsed.  
    - Logging.  The program now uses Winston to have different logs.  The Pentair bus has a LOT of messages.  All the output, debug messages, etc, are being saved to 'pentair_full_dump.log' and successful messages are being logged to 'pentair_info.log'.  I will update these names, but if you want less logging, set the transports to ```level: 'error'``` from 'level: 'silly'.  It's just silly how much it logs at this level!
    - Decoding.  The code is getting pretty good at understanding the basic message types.  There are some that I know and still have to decode; some that I know mostly what they do, and some that are still mysteries!  Please help here. 

0.0.3 - More bug fixes.  Now detects heat mode changes for both pool & spa.  Logging is set to very low (console), but still nearly everything will get written to the logs (see 0.0.2 notes). I've noticed that if any material change is made to the configuration (temp, heat mode, circuit names, etc) Pentair will spit out about 40 lines of configuration.  Reading this is a little challenging but I have figured out a few things.
0.0.4 - Added UOM (Celsius or Farenheit) thank you rflemming for your contributions!  Also added a 'Diff' line to the equipment output to easily see what has changed at the byte level.

0.0.5 - Added a very simple websocket resource (http://server:3000) which will display the output from the pool.  Will make it pretty, and interactive, shortly.

# Configuration
1.  Edit the config.json to match your PHYSICAL circuits.  The code will dynamically map the circuits to their virtual counterparts automatically.  You can not get this from the iPhone, iPad (or Android?) apps.  You will need to go to the controller to get the physical mapping or look in the setup section of your ScreenLogic app.  They aren't numbered, either, so just add them in the order you see them.

*You must skip circuit 10.  I don't know why, or I'm missing something, but it doesn't seem to be used.*
    ```
    {
    "Pentair": {
        "circuit1": "Spa",
        "circuit2": "Jets",
        "circuit3": "Air Blower",
        "circuit4": "Cleaner",
        "circuit5": "WaterFall 1.5",
        "circuit6": "Pool",
        "circuit7": "Spa Lights",
        "circuit8": "Pool Lights",
        "circuit9": "Path Lights",
        "circuit10": "<--SKIP ME-->",
        "circuit11": "Spillway",
        "circuit12": "Waterfall 1",
        "circuit13": "Waterfall 2",
        "circuit14": "Waterfall 3",
        "circuit15": "Pool Low",
        "circuit16": "Feature6",
        "circuit17": "Feature7",
        "circuit18": "Feature8"
    }
}
        ```
# Methodology

The RS-485 bus is VERY active!  It sends a lot of broadcasts, and instructions/acknowledgements.  I tried to filter out all repeating messages, and add some text descriptions to the known (but not decoded) messages like heater commands, valves, etc.  We already have some of the pump commands.

Request for a status change:
```
Msg# 16   Wireless asking Main to change pool heat mode to Heater (@ 87 degrees) % spa heat mode to Solar Only (at 100 degrees): [16,34,136,4,87,100,13,0,2,53]
Msg# 326   Remote asking Main to change _feature Path Lights to on_ : [16,32,134,2,9,1,1,113]
```

When any circuit is changed, I display a full breakdown of all the circuits and their current status.  This helps them stand out in the logs.  For my pool, a change of a circuit will appear as:
```
-->EQUIPMENT Msg# 25   
 Equipment Status:  { time: '8:57',
  waterTemp: 26,
  temp2: 26,
  airTemp: 18,
  solarTemp: 18,
  uom: '° Celsius',
  Spa: 'off',
  Jets: 'off',
  'Air Blower': 'off',
  Cleaner: 'off',
  'WaterFall 1.5': 'off',
  Pool: 'off',
  'Spa Lights': 'off',
  'Pool Lights': 'off',
  'Path Lights': 'off',
  '<--SKIP ME-->': 'off',
  Spillway: 'off',
  'Waterfall 1': 'off',
  'Waterfall 2': 'off',
  'Waterfall 3': 'off',
  'Pool Low': 'on',
  Feature6: 'off',
  Feature7: 'off',
  Feature8: 'off' }
Msg# 25   What's Different?:  uom: ° Celsius --> ° Farenheit
                          S       L                                                           W               A   S
                          O       E           M   M   M                                       T               I   O
                      D   U       N   H       O   O   O                   U                   R   T           R   L                                       C   C
                      E   R       G   O   M   D   D   D                   O                   T   M           T   T                                       H   H
                      S   C       T   U   I   E   E   E                   M                   M   P           M   M                                       K   K
                      T   E       H   R   N   1   2   3                                       P   2           P   P                                       H   L
Orig:                15, 16,  2, 29,  8, 57,  0, 64,  0,  0,  0,  0,  0,  4,  3,  0, 64,  4, 26, 26, 32,  0, 18, 18,  0,  0,  3,  0,  0,170,223,  0, 13,  3,202
 New:                15, 16,  2, 29,  8, 57,  0, 64,  0,  0,  0,  0,  0,  0,  3,  0, 64,  4, 26, 26, 32,  0, 18, 18,  0,  0,  3,  0,  0,170,186,  0, 13,  3,161
Diff:                                                                     *                                                                   *            
 <-- EQUIPMENT 
```
An example of pump communication:  ***As of 0.0.3, these are suppressed.  I would like to have a persistent variable for these like the pool status so they will only display when they change.  TBD.
```
--> PUMP  Pump1 
 Pump Status:  {"pump":"Pump1","power":1,"watts":170,"rpm":1250} 
 Full Payload:  [16,96,7,15,10,0,0,0,170,4,226,0,0,0,0,0,1,22,14,2,234] 
<-- PUMP  Pump1 
```

***The following not displayed in console by default starting in 0.0.3.  You can view them in the logs or change the logging options to show in the console.***
An example of a few lines of known code:
```
Msg# 16   Main asking Pump1 for remote control (turn off pump control panel): [96,16,4,1,255,2,25]
Msg# 17   Pump1 confirming it is in remote control: [16,96,4,1,255,2,25]
Msg# 18   Main asking Pump1 to set run to _10_: [96,16,6,1,10,1,38]
Msg# 19   Main confirming it is in run _10_: [16,96,6,1,10,1,38]
Msg# 20   Main asking Pump1 to write a _2, 196, 8, _ command: [96,16,1,4,2,196,8,2,1,234]
```


An example of an unknown payload:  
```
Unknown chatter:  [97,16,4,1,255,2,26]
```

An example of an identified instruction/response:  
```
Chatter [16,97,4,1,255,2,26] is acknowledgement to instruction [97,16,4,1,255,2,26]
```

# Known Issues
1.  Code is messy.  In debugging I randomly switch between data2, status, currentStatus, tmpStatus, etc.  I will fix this up in the future
2.  Still want to decode more of the strings.
3.  No write capabilities yet.  These are forthcoming.
4.  My logging is not where I want it to be.  I'd like to make various logging levels but for now there are only two.  If you want more logging, set

# Protocol
If you read through the below links, you'll quickly learn that the packets can vary their meaning based upon who they are sending the message to, and what they want to say.  It appears the same message can come in 35, 38 or 32 bytes, but of course there will be some differences there.

WRONG --> I already figured out the mysterious 0x02 bit between Source and Length refers to the heat command of the pool circuit.  If this 2 is present, the heat mode is either heater/solar pref/solar only.  If the heat mode is off, this bit is excluded and the packet looks completely different (on the to-do list.)


# Credit

1.  [Jason Young](http://www.sdyoung.com/home/decoding-the-pentair-easytouch-rs-485-protocol) (Read both posts, they are a great baseline for knowledge)
2.  [Michael (lastname unknown)](http://cocoontech.com/forums/topic/13548-intelliflow-pump-rs485-protocol/?p=159671) - Registration required.  Jason Young used this material for his understanding in the protocol as well.  There is a very detailed .txt file with great information that I won't post unless I get permission.
3.  [Michael Usner](https://github.com/michaelusner/Home-Device-Controller) for taking the work of both of the above and turning it into Javascript code.  
4.  [rflemming](https://github.com/rflemming) for being the first to contribute some changes to the code.
