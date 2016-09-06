# Version 0.0.9
tl;dr

 Important changes:
 
 If you get a SerialPort error, I updated this module to 4.0.1.  Please 'npm uninstall serialport' and then 'npm install'.  

 Configuration is now read from your pool.  The app will send the commands to read the custom name strings, circuit names and schedules.  
 
 The web UI will dynamically load as the information is received.
 
 Visit http://_your_machine_name_:3000 to see a basic UI
 
 Visit http://_your_machine_name_:3000/debug.html for a way to listen for specific messages
 
 Logging has been significantly revised.  See the log variables in index.js to adjust.

 REST/API:  You can use Sockets.IO to subscribe to updates (see the "basic UI" example).  
 You can also call REST URI's like:  
 * Get circuit status: /circuit/# to get the status of circuit '#'
 * Toggle circuit status: /circuit/#/toggle to get the toggle circuit '#'
 * Get system status: /status
 * Get schedules: /schedule
 * Get pump status: /pump
 * Set spa heat setpoint: /spaheat/setpoint/#
 * Set spa heat mode: /spaheat/mode/#  (0=off, 1=heater, 2=solar pref, 3=solar only)
 * Set pool heat setpoint: /poolheat/setpoint/#
 * Set pool heat mode: /poolheat/mode/# (0=off, 1=heater, 2=solar pref, 3=solar only)
    


# nodejs-Pentair

This is a set of test code to read and write back to the Pentair system messages off of the RS-485 serial bus.  

This code will build upon the work of others in understanding the protocol and enable stand-alone control or inclusion in a home automation project.  I personally want to use this to create another module for the [HomeBridge page](https://github.com/nfarina/homebridge) (Apple Homekit integration for the impatient).

See credits below as many have done great work before me.

My goals of this project are:
1.  Understand the messages on the bus.  There are many that are understood, but even more that are still a mystery.
2.  Build code that can be used as a plug-in (phase II)


# Installation

1. This code **REQUIRES** a RS485 serial module.  There are plenty of sites out there that describe the RS485 and differences from RS232 so I won't go into detail here.  ~~I purchased an [EZSync FTDI](http://www.amazon.com/EZSync-RS485-USB-RS485-WE-compatible-EZSync010/dp/B010KJSCR8?ie=UTF8&psc=1&redirect=true&ref_=oh_aui_detailpage_o01_s00).~~
UPDATE - I had trouble with the EZSync in that it won't write back to the bus.  I purchased a very inexpensive [JBTek](https://www.amazon.com/gp/product/B00NKAJGZM/ref=oh_aui_search_detailpage?ie=UTF8&psc=1) adapter and had better luck with it.

2.  Connect the DATA+ and DATA-.

3.  To see if you are getting the proper communications from the bus, before you even try to run this program, run from your *nix command line ```od -x < /dev/ttyUSB0```.  Of course, you'll need to change the address of your RS-485 adapter if it isn't the same as mine (here and in the code).

* 3a   You'll know you have the wires write when the output of this command looks like (you should see multiple repititions of ffa5ff): 
```
0002240 0000 0000 0000 0000 0000 ff00 ffff ffff
0002260 *ffff 00ff a5ff* 0f0a 0210 161d 000c 0040
0002300 0000 0000 0300 4000 5004 2050 3c00 0039
0002320 0400 0000 597a 0d00 af03 00ff a5ff 100a
0002340 e722 0001 c901 ffff ffff ffff ffff ff00
```

* 3b.  This is the WRONG wiring (no ffa5ff present).
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

0.0.6 - 
* Circuits, custom names, and schedules can now be read from the configuration broadcast by the pool.  However, you need to force the configuration to be re-broadcast by changing the heat set point.  This will change in future versions when successful writing to the serial bus is included.
* http://_your_machine_name_:3000 to see a basic UI (websockets with persistent updates on status)
* http://_your_machine_name_:3000/debug.html for a way to listen for specific messages
* It is clear that I will need to change around the internal structure of how the circuits and equipment information is stored so that it can be better presented in the UI and display can be dependent on circuit type (pool, spa, lights, etc) and desired changes (on/off, set temperature, set mode, etc) can know what information is needed

0.0.7 -
* Writeback enabled!  (after much frustration)
* UI for web updated
* Refactored code in many different ways
* Really messed up the logging in the course of debugging.  I need to fix this.
* Need to still update the web UI for the status of the system and also the REST api for hooks to other HA apps.
* I'm having trouble with the RS485 cable above, but purchased another one for <$5 from Amazon that is working better.


0.0.8 -
* Significantly revised the logging.  It now comes with more options, and by default, is much quieter.
* Got rid of the logging to the files.  It wasn't useful.  Winston can easily be modified to write back to the log files if your situation dictates this.
* Sockets.io compatability
* REST API

0.0.9 -
* Added REST API and Sockets.io call to change heat set point and change heat mode
* Updated UI to reflect new Socket calls (you can now change the heat mode and pool temp).  
* Updated SerialPort to 4.0.1.


# Methodology

The RS-485 bus is VERY active!  It sends a lot of broadcasts, and instructions/acknowledgements.  Many commands are known, but feel free to help debug more if you are up for the challenge!  See the wiki for what we know.  Below are a sample of the message

Request for a status change:
```
22:14:20.171 INFO Msg# 739   Wireless asking Main to change pool heat mode to Solar Only (@ 88 degrees) & spa heat mode to Solar Only (at 100 degrees): [16,34,136,4,88,100,15,0,2,56]

```

When the app starts, it will show the circuits that it discovers.  For my pool, the circuits are:
```
22:07:59.241 INFO Msg# 51  Initial circuits status discovered:
SPA : off
JETS : off
AIR BLOWER : off
CLEANER : off
WtrFall 1.5 : off
POOL : on
SPA LIGHT : off
POOL LIGHT : off
PATH LIGHTS : off
SPILLWAY : off
WtrFall 1 : off
WtrFall 2 : off
WtrFall 3 : off
Pool Low2 : on
NOT USED : off
NOT USED : off
NOT USED : off
AUX EXTRA : off
```

To dispaly the messages below, change the logging level to VERBOSE.
```
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
An example of pump communication.  To show these, change logPumpMessages from 0 to 1. 
```
--> PUMP  Pump1 
 Pump Status:  {"pump":"Pump1","power":1,"watts":170,"rpm":1250} 
 Full Payload:  [16,96,7,15,10,0,0,0,170,4,226,0,0,0,0,0,1,22,14,2,234] 
<-- PUMP  Pump1 
```


An example of an unknown payload:  
```
Unknown chatter:  [97,16,4,1,255,2,26]
```


# Known Issues
1.  Still many messages to debug
2.  Still many messages to debug
3.  Still many messages to debug


# Protocol
If you read through the below links, you'll quickly learn that the packets can vary their meaning based upon who they are sending the message to, and what they want to say.  It appears the same message can come in 35, 38 or 32 bytes, but of course there will be some differences there.


# Credit

1.  [Jason Young](http://www.sdyoung.com/home/decoding-the-pentair-easytouch-rs-485-protocol) (Read both posts, they are a great baseline for knowledge)
2.  [Michael (lastname unknown)](http://cocoontech.com/forums/topic/13548-intelliflow-pump-rs485-protocol/?p=159671) - Registration required.  Jason Young used this material for his understanding in the protocol as well.  There is a very detailed .txt file with great information that I won't post unless I get permission.
3.  [Michael Usner](https://github.com/michaelusner/Home-Device-Controller) for taking the work of both of the above and turning it into Javascript code.  
4.  [rflemming](https://github.com/rflemming) for being the first to contribute some changes to the code.
