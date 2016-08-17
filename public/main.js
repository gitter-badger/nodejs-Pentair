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

    //var $statusPage = $('.status.page') // The status page


    var socket = io();


    $('body').on('click', 'input', function () {
        //alert("event.target.id: " + event.target.id + " event.target.attr: " + JSON.stringify(event.target.attributes))

        setEquipmentStatus($(this).data($(this).attr('id')));
    })


    $('#switchToConfig').click(function () {
        //alert('#status ' + $('#status') + '   and #config ' + $('#config'))
        $('#status').hide();
        $('#config').show();
    })


    $('#switchToStatus').click(function () {
        $('#config').hide();
        $('#status').show();
    })

    function addStatus(data) {




        if (!data) alert("reload page.  pool data not ready")

        var i = 1;
        for (i; i < 21; i++) {
            //console.log(i)
            //console.log(JSON.stringify(data[i]))

            if (data[i].hasOwnProperty('name')) {
                if (data[i].name != "NOT USED") {
                    if ((i != 10) || (i != 19)) {

                        if (document.getElementById(data[i].numberStr)) {

                            if (i==9){
                                console.log('9: %s & checked?: %s',data[i].status, data[i].status == "on" ? true : false)
                            }
                            //update the element

                            /*$('#' + data[i].numberStr).html(data[i].name).data(data[i].numberStr, data[i].number)
                            if (data[i].status == "on") {


                                $('#' + data[i].numberStr).append('<div style="position: absolute;top: 80px;right: 0;width:border: 3px solid #73AD21;">my label</div> <div id="toggles"><input type="checkbox" name="checkbox1" id="checkbox1" class="ios-toggle" checked />');
                                $('#' + data[i].numberStr).append('<label for="checkbox1" class="checkbox-label" data-off="off" data-on="on"></div>');
                            } else {

                                $('#' + data[i].numberStr).append('<div id="toggles"><label>' + data[i].name + '</label><input type="checkbox" name="checkbox1" id="checkbox1" class="ios-toggle" />');
                                $('#' + data[i].numberStr).append('<label for="checkbox1" class="checkbox-label" data-off="off" data-on="on"></div>');
                            }*/

                            $('#' + data[i].numberStr).prop('checked', data[i].status == "on" ? true : false);

                            //text only
                            //$('#' + data[i].numberStr).text(data[i].name + ' is ' + data[i].status).data(data[i].numberStr,data[i].number)


                        } else {


                            //$('#status').append('<p  class="status2" id="' + data[i].numberStr + '">' + data[i].name + '</p>');


                            var checked = ""
                            if (data[i].status == "on") {
                                checked = "checked"
                            }
                            $('#status').append('<input type="checkbox" name="' + data[i].numberStr + '" id="' + data[i].numberStr + '" class="ios-toggle" ' + checked + '/><label for="' + data[i].numberStr + '" class="checkbox-label" data-off="' + data[i].name + '" data-on="' + data[i].name + '"></label>');
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
        socket.emit('toggleEquipment', equipment)
            //There is a problem here with some names, like 'WtrFall 1.5'.  The . is a problem.

    };
    // Whenever the server emits 'status', update the page

    socket.on('status', function (data) {
        //console.log(data)
        addStatus(data);

        $input.text('Type Equipment Here...')
    });


});