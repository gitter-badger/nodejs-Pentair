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


    $("p").on("click", function(){
        alert("called")
    })   


    
    

    
    
    
    function addStatus(data) {

        
        
        
if (!data) alert ("reload page.  pool data not ready")
        $.each(data, function (key, value) {
            
            var keyNoSpace = key.split(' ').join('_'); //if spaces, replace with _
     
            if (document.getElementById(keyNoSpace)) {

                //update the element
                $('#' + keyNoSpace).text(key + ' is ' + value).data(key)

                console.log('Found existing element: ' + $('#' + keyNoSpace).text())
            } else {
                console.log('2');
                $('#status').append('<p  id="' + keyNoSpace+ '">' + key + ' is ' + value + '</p>');
                
                console.log('Creating new element: ' + key)
            }
                                //.append('<li id="' + keyNoSpace + '">' + key + ' is ' + value + '    </li>')
            //console.log('key: ' + key + ' value: ' + value);
            //$status.append('key: ' + key + ' value: ' + value)
        });

        $status.show();
    }



    // Socket events

    function setEquipmentStatus() {
        input = $('#equipmentChange').text(input).text();
        socket.emit('toggleEquipment', input)

    };
    // Whenever the server emits 'status', update the page

    socket.on('status', function (data) {
        addStatus(data);
        $input.text('Type Equipment Here...')
    });


});