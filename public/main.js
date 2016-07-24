$(function () {
    var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms
    var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

    // Initialize variables



    var $window = $(window);
    var $status = $('.status'); //status area
    var $input = $('equipmentChange')

    var $statusPage = $('.status.page') // The status page


    var socket = io();


    $('body').on('click', 'p.status2', function () {
        <!-- alert( "My alert: " + $(this).attr('id') +" name: " + $(this).data('name')  + " data: " + $(this).data($(this).data('name')))  -->
        setEquipmentStatus($(this).data('name'));
    })



    function addStatus(data) {




        if (!data) alert("reload page.  pool data not ready")
        $.each(data, function (key, value) {

            var keyNoSpace = key.split(' ').join('_'); //if spaces, replace with _

            if (document.getElementById(keyNoSpace)) {

                //update the element
                $('#' + keyNoSpace).text(key + ' is ' + value).data(key,value).data()

                <!-- console.log('Found existing element: ' + $('#' + keyNoSpace).text())  -->
            } else {
                $('#status').append('<p  class="status2" id="' + keyNoSpace + '">' + key + ' is ' + value + '</p>');
                $('#'+keyNoSpace).data(keyNoSpace,value).data('name',key);

                <!-- console.log('Creating new element: ' + key) -->
            }

        });

        $status.show();
    }



    // Socket events

    function setEquipmentStatus(equipment) {
        socket.emit('toggleEquipment', equipment)
        //There is a problem here with some names, like 'WtrFall 1.5'.  The . is a problem.

    };
    // Whenever the server emits 'status', update the page

    socket.on('status', function (data) {
        addStatus(data);
        $input.text('Type Equipment Here...')
    });


});