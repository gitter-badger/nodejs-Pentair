$(function () {
    var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms
    var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

    // Initialize variables



    //var $window = $(window);
    //var $status = $('.status'); //status area
    var $input = $('equipmentChange')
    var $pump = $('#pump')
    var $config = $('#config')
    var $circuit = $('#circuit')
    var $schedule = $('#schedule')


    //var $statusPage = $('.status.page') // The status page


    var socket = io();
    $config.hide();
    $pump.hide();
    $schedule.hide();
    $circuit.show();

    $('body').on('click', 'input', function () {
        //alert("event.target.id: " + event.target.id + " event.target.attr: " + JSON.stringify(event.target.attributes))

        setEquipmentStatus($(this).data($(this).attr('id')));
    })


    $('#switchToConfig').click(function () {
        //alert('#status ' + $('#status') + '   and #config ' + $('#config'))
        $pump.hide()
        $circuit.hide();
        $schedule.hide();
        $config.show();

    })


    $('#switchToCircuit').click(function () {
        $config.hide();
        $pump.hide();
        $schedule.hide();
        $circuit.show();
    })

    $('#switchToPump').click(function () {
        $config.hide();
        $circuit.hide();
        $schedule.hide();
        $pump.show();

    })

    $('#switchToSchedule').click(function () {
        $config.hide();
        $circuit.hide();
        $schedule.show();
        $pump.hide();
    })

    function addPump(data) {
        //$pump.append(JSON.stringify(data[1]))
        //$pump.append(JSON.stringify(data[2]))

        $('#pump1').html(data[1].name + '<br>Watts: ' + data[1].watts + '<br>RPM: ' + data[1].rpm + '<br>Error: ' + data[1].err + '<br>Mode: ' + data[1].mode + '<br>Drive state: ' + data[1].drivestate + '<br>Run Mode: ' + data[1].run)
        $('#pump2').html(data[1].name + '<br>Watts: ' + data[2].watts + '<br>RPM: ' + data[2].rpm + '<br>Error: ' + data[2].err + '<br>Mode: ' + data[2].mode + '<br>Drive state: ' + data[2].drivestate + '<br>Run Mode: ' + data[2].run)


    }

    function addConfig(data) {


        if (data != null) {
            $('#config').html('Time #: ' + data.TIME +
                '<br>Water Temp: ' + data.waterTemp +
                '<br>Temp 2(?): ' + data.temp2 +
                '<br>Air Temp: ' + data.airTemp +
                '<br>Solar Temp: ' + data.solarTemp +
                '<br>Pool Heat Mode: ' + data.poolHeatMode +
                '<br>Spa Heat Mode: ' + data.spaHeatMode +
                '<br>Pool Heat Mode2 (?): ' + data.poolHeatMode2 +
                '<br>Spa Heat Mode2 (?): ' + data.spaHeatMode2 +
                '<br>Valve: ' + data.valves +
                '<br>Run Mode: ' + data.runmode +
                '<br>Unit of Measure: ' + data.UOM +
                '<br>Heater Active(?): ' + data.HEATER_ACTIVE +
                '<p>')
        }


        //$config.append(JSON.stringify(data))

    }


    function addSchedule(data) {


        $('#schedules').html('Schedules<p>');
        $('#eggTimer').html('Egg Timers<p>');
        var i = 1;

        for (i; i < data.length; i++) {

            if (data[i].MODE == "Schedule") {
                $('#schedules').append('Schedule #: ' + data[i].ID +
                    '<br>Circuit: ' + data[i].CIRCUIT +
                    '<br>Start Time: ' + data[i].START_TIME +
                    '<br>End Time: ' + data[i].END_TIME +
                    '<br>Days: ' + data[i].DAYS +
                    '<p>')

            } else //Egg timer
            {
                $('#eggTimer').append('Schedule #: ' + data[i].ID +
                    '<br>Circuit: ' + data[i].CIRCUIT +
                    '<br>Duration: ' + data[i].DURATION +
                    '<p>')

            }
        }

    }

    function addHeat(data) {
        //$('#pool').append(data.POOLSETPOINT + ' ' + data.POOLHEATMODE)
        //$('#spa').append(data.SPASETPOINT + ' ' + data.SPAHEATMODE)
        //console.log('received' + JSON.stringify(data))


        $('#poolHeatSetPoint').html('Temp: ' + data.POOLSETPOINT)
        $('#spaHeatSetPoint').html('Temp: ' + data.SPASETPOINT)


        switch (data.POOLHEATMODE) {
        case "Off":
            {
                $('#poolHeatModeOff').prop('checked', true);
                $('#poolHeatModeHeater').prop('checked', false);
                $('#poolHeatModeSolarPref').prop('checked', false);
                $('#poolHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Heater":
            {
                $('#poolHeatModeOff').prop('checked', false);
                $('#poolHeatModeHeater').prop('checked', true);
                $('#poolHeatModeSolarPref').prop('checked', false);
                $('#poolHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Solar Pref":
            {
                $('#poolHeatModeOff').prop('checked', false);
                $('#poolHeatModeHeater').prop('checked', false);
                $('#poolHeatModeSolarPref').prop('checked', true);
                $('#poolHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Solar Only":
            {
                $('#poolHeatModeOff').prop('checked', false);
                $('#poolHeatModeHeater').prop('checked', false);
                $('#poolHeatModeSolarPref').prop('checked', false);
                $('#poolHeatModeSolarOnly').prop('checked', true);
            }


        }


        switch (data.SPAHEATMODE) {
        case "Off":
            {
                $('#spaHeatModeOff').prop('checked', true);
                $('#spaHeatModeHeater').prop('checked', false);
                $('#spaHeatModeSolarPref').prop('checked', false);
                $('#spaHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Heater":
            {
                $('#spaHeatModeOff').prop('checked', false);
                $('#spaHeatModeHeater').prop('checked', true);
                $('#spaHeatModeSolarPref').prop('checked', false);
                $('#spaHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Solar Pref":
            {
                $('#spaHeatModeOff').prop('checked', false);
                $('#spaHeatModeHeater').prop('checked', false);
                $('#spaHeatModeSolarPref').prop('checked', true);
                $('#spaHeatModeSolarOnly').prop('checked', false);
                break;
            }
        case "Solar Only":
            {
                $('#spaHeatModeOff').prop('checked', false);
                $('#spaHeatModeHeater').prop('checked', false);
                $('#spaHeatModeSolarPref').prop('checked', false);
                $('#spaHeatModeSolarOnly').prop('checked', true);
            }


        }



    }

    function addCircuit(data) {
        //if (!data) alert("reload page.  pool data not ready")

        var i = 1;
        for (i; i < 21; i++) {
            //console.log(i)
            //console.log(JSON.stringify(data[i]))

            if (data[i].hasOwnProperty('name')) {
                if (data[i].name != "NOT USED") {
                    if ((i != 10) || (i != 19)) {

                        if (document.getElementById(data[i].numberStr)) {




                            $('#' + data[i].numberStr).prop('checked', data[i].status == "on" ? true : false);



                        } else {


                            //$('#status').append('<p  class="status2" id="' + data[i].numberStr + '">' + data[i].name + '</p>');


                            var checked = ""
                            if (data[i].status == "on") {
                                checked = "checked"
                            }
                            console.log(data[i].name + ' : ' + data[i].circuitFunction)
                            var $whichDiv = $('#features');
                            if (data[i].circuitFunction == "Spa") {
                                $whichDiv = $('#spa');
                            } else if (data[i].circuitFunction == "Pool") {
                                $whichDiv = $('#pool')
                            } else if (data[i].circuitFunction == "Light") {
                                $whichDiv = $('#light')
                            }
                            // console.log('whichDiv assigend %s  (%s : %s)', )
                            $whichDiv.append('<br>' + data[i].name + '<input type="checkbox" name="' + data[i].numberStr + '" id="' + data[i].numberStr + '" />');
                            $('#' + data[i].numberStr).data(data[i].numberStr, data[i].number)
                        }

                        //$status.show();
                    }
                }
            }
        }
    }



    // Socket events

    function setEquipmentStatus(equipment) {
        socket.emit('toggleCircuit', equipment)
            //There is a problem here with some names, like 'WtrFall 1.5'.  The . is a problem.

    };
    // Whenever the server emits 'status', update the page

    socket.on('circuit', function (data) {
        //console.log(data)
        addCircuit(data);

        //$input.text('Type Equipment Here...')
    });

    socket.on('config', function (data) {
        //console.log(data)
        addConfig(data);

    });

    socket.on('pump', function (data) {
        addPump(data);
    })

    socket.on('heat', function (data) {
        addHeat(data);
    })

    socket.on('schedule', function (data) {
        addSchedule(data);
    })


});