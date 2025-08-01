/* Common data and functions for overlays */
var request_time;
var request_pi_time;
var resume_check = true;

function speak(obj, priority) {} // stub to prevent crashing

/* default handlers for RotorHazard events */
// NOTE: 'race_kickoff' must be defined locally in the HTML
default_handler = {
    'language': function (msg) {
        if (msg.language) {
            rotorhazard.interface_language = msg.language;
        }
    },
    
    'race_scheduled': function (msg) {
        if (msg.scheduled) {
            var deferred_start = msg.scheduled_at * 1000;  // convert seconds (pi) to millis (JS)
            rotorhazard.timer.deferred.start(deferred_start, null);
        } else {
            rotorhazard.timer.deferred.stop();
        }
    },
    
    'race_status': function (msg) {
        switch (msg.race_status) {
            case 1: // Race running
                rotorhazard.race_status_go_time = window.performance.now();
                $('body').addClass('race-running');
                $('body').removeClass('race-stopped');
                $('body').removeClass('race-new');
                $('.timing-clock').removeClass('staging');
                if (resume_check) {
                    race_kickoff(msg);
                }
                break;
            case 2: // Race stopped, clear or save laps
                $('body').removeClass('race-running');
                $('body').addClass('race-stopped');
                $('body').removeClass('race-new');
                $('.timing-clock').removeClass('staging');
                break;
            case 3: // Staging
                $('body').removeClass('race-stopped');
                $('body').addClass('race-running');
                $('body').removeClass('race-new');
                $('.timing-clock').addClass('staging');
                if (resume_check) {
                    race_kickoff(msg);
                }
                break;
            default: // Waiting to start new race
                $('body').removeClass('race-running');
                $('body').removeClass('race-stopped');
                $('body').addClass('race-new');
                $('.timing-clock').removeClass('staging');
                if (resume_check) {
                    socket.emit('get_race_scheduled');
                }
                break;
        }

        resume_check = false;
    },
    
    'heartbeat': function (msg) {
    },
    
    'prestage_ready': function (msg) {
        request_time = new Date();
    },
    
    'stage_ready': function (msg) {
        race_kickoff(msg);
    },
    
    'stop_timer': function (msg) {
        rotorhazard.timer.stopAll();
    },
    
    'pi_time': function (msg) {
        var response_time = window.performance.now();
        var server_delay = response_time - rotorhazard.pi_time_request;
        var server_oneway = server_delay ? server_delay / 2 : server_delay;

        var server_time_differential = {
            'differential': (msg.pi_time_s * 1000) - response_time - server_oneway, // convert seconds (pi) to millis (JS)
            'response': parseFloat(server_delay)
        }

        // store sync sample
        rotorhazard.server_time_differential_samples.push(server_time_differential);

        // sort stored samples
        rotorhazard.server_time_differential_samples.sort(function(a, b) {
            return a.response - b.response;
        })

        // remove unusable samples
        var diff_min = rotorhazard.server_time_differential_samples[0].differential - rotorhazard.server_time_differential_samples[0].response
        var diff_max = rotorhazard.server_time_differential_samples[0].differential + rotorhazard.server_time_differential_samples[0].response

        rotorhazard.server_time_differential_samples = rotorhazard.server_time_differential_samples.filter(function(value, index, array) {
            return value.differential >= diff_min && value.differential <= diff_max;
        });

        // get filtered value
        var a = [];
        for (var i in rotorhazard.server_time_differential_samples) {
            a.push(rotorhazard.server_time_differential_samples[i].differential);
        }
        rotorhazard.server_time_differential = median(a);

        // pass current sync to timers
        rotorhazard.timer.race.sync();
        rotorhazard.timer.deferred.sync();

        // continue sampling for sync to improve accuracy
        if (rotorhazard.server_time_differential_samples.length < 10) {
            setTimeout(function() {
                rotorhazard.pi_time_request = window.performance.now();
                socket.emit('get_pi_time');
            }, (Math.random() * 500) + 250); // 0.25 to 0.75s delay
        }

        // update server info
        var a = Infinity;
        for (var i in rotorhazard.server_time_differential_samples) {
            a = Math.min(a, rotorhazard.server_time_differential_samples[i].response);
        }
        rotorhazard.sync_within = Math.ceil(a);
        //$('#server-lag').html('<p>Sync quality: within ' + a + 'ms (' + rotorhazard.server_time_differential_samples.length + ' samples)</p>');
    },
};



/* Format-related functions */
function get_number_of_pilots_from_format(bracket_type) {
    var format_16 = ['multigp16', 'fai16', 'fai16de'];
    if (format_16.includes(bracket_type)) {
        return 16;
    }
    
    var format_32 = ['fai32', 'fai32de'];
    if (format_32.includes(bracket_type)) {
        return 32;
    }
    
    var format_64 = ['fai64', 'fai64de'];
    if (format_64.includes(bracket_type)) {
        return 64;
    }
    
    return 999;
}



/* HTML generators */
function build_nextup(leaderboard, display_type, meta, ddr_pilot_data, show_position=false) {
    if (typeof(display_type) === 'undefined') {
        var display_type = 'by_race_time';
    }
    if (typeof(meta) === 'undefined') {
        var meta = new Object;
        meta.team_racing_mode = false;
        meta.start_behavior = 0;
        meta.consecutives_count = 0;
        meta.primary_leaderboard = null;
    }

    for (var i in leaderboard) {
        let pilot_name = leaderboard[i].callsign;       
        let flagImg = getFlagURL(leaderboard[i].pilot_id, ddr_pilot_data);
        let pilotImg = getPilotImgURL(leaderboard[i]);

        let html = '<div class="nextup_pilot">';
        if (show_position) {
            let position_strings = ["1st", "2nd", "3rd", "4th"];
            html += '<div class="nextup_pilot_position">'+ position_strings[i] +'</div>';
            $('#nextup_pilot_box').height(480);  // give more space to show positions (overriding CSS)
            // that's the place where you can add other info such as fastest lap:
            // var fastest_lap = leaderboard[i].fastest_lap;
            // var consecutives = leaderboard[i].consecutives;
        }
        html += '<div class="nextup_pilot_avatar"><div class="nextup_pilot_avatar_mask"><img src="' + pilotImg + '" alt="Avatar"></div></div><div class="nextup_pilot_flag"><div class="nextup_pilot_flag_mask"><img src="' + flagImg + '"></div></div><div class="nextup_pilot_name">' + pilot_name + '</div></div>';

        $('#nextup_pilot_box').append(html);
    }
}

function build_leaderboard(leaderboard, display_type, meta, number_of_pilots=999, ddr_pilot_data=[], display_starts=false) {
    if (typeof(display_type) === 'undefined') {
        var display_type = 'by_race_time';
    }
    if (typeof(meta) === 'undefined') {
        var meta = new Object;
        meta.team_racing_mode = false;
        meta.start_behavior = 0;
        meta.consecutives_count = 0;
        meta.primary_leaderboard = null;
    }

    if (display_type == 'round') {
        var show_points = true;
    } else {
        var show_points = false;
    }

    if (meta.start_behavior == 2) {
        var total_label = __('Laps Total');
    } else {
        var total_label = __('Total');
    }

    var twrap = $('<div class="responsive-wrap">');
    var table = $('<table class="leaderboard">');
    var header = $('<thead>');
    var header_row = $('<tr>');
    header_row.append('<th class="pos">' + 'Pos' + '</th>');
    header_row.append('<th class="avatar"><span class="screen-reader-text">' +'Avatar' + '</span></th>');
    header_row.append('<th class="flags"><span class="screen-reader-text">' + 'Flag' + '</span></th>');

    header_row.append('<th class="pilot">' + __('Pilot') + '</th>');
    if (meta.team_racing_mode) {
        header_row.append('<th class="team">' + __('Team') + '</th>');
    }
    if (display_starts == true) {
        header_row.append('<th class="starts">' + __('Starts') + '</th>');
    }
    if (display_type == 'by_race_time' ||
        display_type == 'heat' ||
        display_type == 'round' ||
        display_type == 'current') {
        header_row.append('<th class="laps">' + __('Laps') + '</th>');
        header_row.append('<th class="total">' + total_label + '</th>');
        header_row.append('<th class="avg">' + __('Avg.') + '</th>');
    }
    if (display_type == 'by_fastest_lap' ||
        display_type == 'heat' ||
        display_type == 'round' ||
        display_type == 'current') {
        header_row.append('<th class="fast">' + __('Fastest') + '</th>');
        if (display_type == 'by_fastest_lap') {
            header_row.append('<th class="source">' + __('Source') + '</th>');
        }
    }
    if (display_type == 'by_consecutives' ||
        display_type == 'heat' ||
        display_type == 'round' ||
        display_type == 'current') {
        header_row.append('<th class="consecutive">' + __('Consecutive') + '</th>');
        if (display_type == 'by_consecutives') {
            header_row.append('<th class="source">' + __('Source') + '</th>');
        }
    }
    if (show_points && 'primary_points' in meta) {
        header_row.append('<th class="points">' + __('Points') + '</th>');
    }
    header.append(header_row);
    table.append(header);

    var body = $('<tbody>');

    for (var i in leaderboard) {
        if (i < number_of_pilots) {
            var row = $('<tr id="pilot_id_' + leaderboard[i].pilot_id + '">');

            row.append('<td class="pos">'+ (leaderboard[i].position || '-') +'</td>');

            var pilotImg = getPilotImgURL(leaderboard[i]);
            row.append('<td class="avatar"><img src=" ' + pilotImg + ' "></td>');

            let flagImg = getFlagURL(leaderboard[i].pilot_id, ddr_pilot_data);
            row.append('<td class="flag" id="pilot_id_flag_' + leaderboard[i].pilot_id + '"><img class="country_flag" src="' + flagImg + '"></td>');

            var pilot_name_flag = leaderboard[i].callsign;

            row.append('<td class="pilot">' + pilot_name_flag + '</td>');
            if (meta.team_racing_mode) {
                row.append('<td class="team">' + leaderboard[i].team_name + '</td>');
            }
            if (display_starts == true) {
                row.append('<td class="starts">' + leaderboard[i].starts + '</td>');
            }
            if (display_type == 'by_race_time' ||
                display_type == 'heat' ||
                display_type == 'round' ||
                display_type == 'current') {
                var lap = leaderboard[i].laps;
                if (!lap || lap == '0:00.000')
                    lap = '&#8212;';
                row.append('<td class="laps">'+ lap +'</td>');

                if (meta.start_behavior == 2) {
                    var lap = leaderboard[i].total_time_laps;
                    var lap_raw = leaderboard[i].total_time_laps_raw;
                } else {
                    var lap = leaderboard[i].total_time;
                    var lap_raw = leaderboard[i].total_time_raw;
                }
                if (!lap_raw || lap_raw == 0)
                    lap = '&#8212;';
                row.append('<td class="total">'+ lap +'</td>');

                var lap = leaderboard[i].average_lap;
                var lap_raw = leaderboard[i].average_lap_raw;
                if (!lap_raw || lap_raw == 0)
                    lap = '&#8212;';
                row.append('<td class="avg">'+ lap +'</td>');
            }
            if (display_type == 'by_fastest_lap' ||
                display_type == 'heat' ||
                display_type == 'round' ||
                display_type == 'current') {
                var lap = leaderboard[i].fastest_lap;
                var lap_raw = leaderboard[i].fastest_lap_raw;
                if (!lap_raw || lap_raw == 0)
                    lap = '&#8212;';

                var el = $('<td class="fast">'+ lap +'</td>');

                if (leaderboard[i].fastest_lap_source) {
                    var source = leaderboard[i].fastest_lap_source;
                    var source_text = source.displayname + ' / ' + __('Round') + ' ' + source.round;
                } else {
                    var source_text = 'None';
                }

                if (display_type == 'heat') {
                    el.data('source', source_text);
                    el.attr('title', source_text);
                }

                row.append(el);

                if (display_type == 'by_fastest_lap') {
                    row.append('<td class="source">' + source_text + '</td>');
                }
            }
            if (display_type == 'by_consecutives' ||
                display_type == 'heat' ||
                display_type == 'round' ||
                display_type == 'current') {
                var data = leaderboard[i];
                if (!data.consecutives_raw || data.consecutives_raw == 0) {
                    lap = '&#8212;';
                } else {
                    lap = data.consecutives_base + '/' + data.consecutives;
                }

                var el = $('<td class="consecutive">' + lap + '</td>');

                if (leaderboard[i].consecutives_source) {
                    var source = leaderboard[i].consecutives_source;
                    var source_text = source.displayname + ' / ' + __('Round') + ' ' + source.round;
                } else {
                    var source_text = 'None';
                }

                if (display_type == 'heat') {
                    el.data('source', source_text);
                    el.attr('title', source_text);
                }

                row.append(el);

                if (display_type == 'by_consecutives') {
                    row.append('<td class="source">' + source_text + '</td>');
                }
            }

            if (show_points && 'primary_points' in meta) {
                row.append('<td class="points">' + leaderboard[i].points + '</td>');
            }
            body.append(row);
        }
    }

    table.append(body);
    twrap.append(table);

    return twrap;
}



/* Pilot data retrieval */
function getFlagURL(pilot_id, ddr_pilot_data) {
    let flagImg = '/ddr_overlays/static/imgs/flags/' + getPilotFlag(pilot_id, ddr_pilot_data) + '.jpg';
    if (!imageExists(flagImg)) {
        flagImg = '/ddr_overlays/static/imgs/flags/nl.jpg';
    }
    return flagImg;
}

function getPilotFlag(pilot_id, ddr_pilot_data) {
    count = Object.keys(ddr_pilot_data).length;
    for (var i = 0; i < count; i++) {
        let pilot = ddr_pilot_data[i];
        if (pilot.pilot_id == pilot_id) {
            pilot = ddr_pilot_data[i];
            if (pilot.country) {
                country_upper = pilot.country;
                return country_upper;
            }
            break;
        }
    }
    return 'it';
}

function getPilotImgURL(pilot) {
    let pilotImg = '/shared/avatars/' + pilot.callsign.replace(/ /g,"_").toLowerCase() + '.jpg';
    if (!imageExists(pilotImg)) {
        pilotImg = '/ddr_overlays/static/imgs/no_avatar.png';
    }
    return pilotImg;
}

function imageExists(image_url) {
    var http = new XMLHttpRequest();
    http.open('HEAD', image_url, false);
    http.send();
    return http.status != 404;
}



/* Functions for pilots */
function render_pilots(rotorhazard) {
    generate_pilot_attributes(rotorhazard);
    for (var i = 0; i < rotorhazard.event.pilots.length; i++) {
        pilot = rotorhazard.event.pilots[i];
        country_flag = pilot.attributes.country.value.toLowerCase();
        pilot_id = pilot.pilot_id;

        // if div exists
        if (document.getElementById('pilot_id_flag_' + pilot.pilot_id)) {
            document.getElementById('pilot_id_flag_' + pilot.pilot_id).innerHTML = '<img class="country_flag" src="/ddr_overlays/static/imgs/flags/' + country_flag + '.jpg">';
        }
    }
}

function generate_pilot_attributes(rotorhazard) {
    for (var i in rotorhazard.event.pilots) {
        var pilot = rotorhazard.event.pilots[i];
        if (pilot.pilot_id != 0) {
            pilot.attributes = [];
            for (var attr_idx in rotorhazard.event.pilot_attributes) {
                var pilot_attr = rotorhazard.event.pilot_attributes[attr_idx];
                if (pilot[pilot_attr.name] != undefined) {
                    pilot_attr.value = pilot[pilot_attr.name];
                } else {
                    pilot_attr.value = '';
                }
                var pilot_attr_name = pilot_attr.name;
                var attr_object = { name: pilot_attr_name, value: pilot_attr.value };
                pilot.attributes[pilot_attr_name] = attr_object;
            }
        }
    }
}



/* HTML generators for brackets */
class BracketHeat {
    constructor(number, type, column, advance_to) {
        this.number = number;          /* heat number, starting from 1 */
        this.type = type;              /* possible values: 'preliminary' | 'winner' | 'loser' */
        this.column = column;          /* column index where the heat shall be rendered, starting from 0 */
        this.advance_to = advance_to;  /* the next heat where the winners of this heat will race
                                        * applicable only if the first and the second classified advance to the same heat */
    }
}

const bracket_formats = {
    "ddr8de":    [
                   new BracketHeat(1,  "preliminary", 0, 4),
                   new BracketHeat(2,  "preliminary", 0, 4),
                   new BracketHeat(3,  "loser",       0, 5),
                   new BracketHeat(4,  "winner",      1, 6),
                   new BracketHeat(5,  "loser",       1, 6),
                   new BracketHeat(6,  "winner",      2),
                 ],
    "multigp16": [
                   new BracketHeat(1,  "preliminary", 0, 6),
                   new BracketHeat(2,  "preliminary", 0, 6),
                   new BracketHeat(3,  "preliminary", 0, 8),
                   new BracketHeat(4,  "preliminary", 0, 8),
                   new BracketHeat(5,  "loser",       0, 9),
                   new BracketHeat(6,  "winner",      1, 11),
                   new BracketHeat(7,  "loser",       0, 10),
                   new BracketHeat(8,  "winner",      1, 11),
                   new BracketHeat(9,  "loser",       1, 12),
                   new BracketHeat(10, "loser",       1, 12),
                   new BracketHeat(11, "winner",      2, 14),
                   new BracketHeat(12, "loser",       2, 13),
                   new BracketHeat(13, "loser",       3, 14),
                   new BracketHeat(14, "winner",      3),
                 ],
    //"fai16":     [],
    "fai16de":   [
                   new BracketHeat(1,  "preliminary", 0),
                   new BracketHeat(2,  "preliminary", 0),
                   new BracketHeat(3,  "preliminary", 0),
                   new BracketHeat(4,  "preliminary", 0),
                   new BracketHeat(5,  "loser",       0),
                   new BracketHeat(6,  "loser",       0),
                   new BracketHeat(7,  "winner",      1),
                   new BracketHeat(8,  "winner",      1),
                   new BracketHeat(9,  "loser",       1),
                   new BracketHeat(10, "loser",       1),
                   new BracketHeat(11, "loser",       2),
                   new BracketHeat(12, "winner",      2),
                   new BracketHeat(13, "loser",       3),
                   new BracketHeat(14, "winner",      3),
                 ],
    //"fai32":     [],
    "fai32de":   [
                   new BracketHeat(1,  "preliminary", 0),
                   new BracketHeat(2,  "preliminary", 0),
                   new BracketHeat(3,  "preliminary", 0),
                   new BracketHeat(4,  "preliminary", 0),
                   new BracketHeat(5,  "preliminary", 1),
                   new BracketHeat(6,  "preliminary", 1),
                   new BracketHeat(7,  "preliminary", 1),
                   new BracketHeat(8,  "preliminary", 1),
                   new BracketHeat(9,  "winner",      2),
                   new BracketHeat(10, "winner",      2),
                   new BracketHeat(11, "winner",      2),
                   new BracketHeat(12, "winner",      2),
                   new BracketHeat(13, "loser",       0),
                   new BracketHeat(14, "loser",       0),
                   new BracketHeat(15, "loser",       0),
                   new BracketHeat(16, "loser",       0),
                   new BracketHeat(17, "loser",       1),
                   new BracketHeat(18, "loser",       1),
                   new BracketHeat(19, "loser",       1),
                   new BracketHeat(20, "loser",       1),
                   new BracketHeat(21, "loser",       2),
                   new BracketHeat(22, "loser",       2),
                   new BracketHeat(23, "winner",      3),
                   new BracketHeat(24, "winner",      3),
                   new BracketHeat(25, "loser",       3),
                   new BracketHeat(26, "loser",       3),
                   new BracketHeat(27, "loser",       4),
                   new BracketHeat(28, "winner",      4),
                   new BracketHeat(29, "loser",       5),
                   new BracketHeat(30, "winner",      5),
                 ],
    //"fai64":     [],
    //"fai64de":   []
}

function build_elimination_brackets(race_bracket_type, race_class_id, ddr_pilot_data, ddr_heat_data, ddr_class_data, ddr_race_data) {

    // clear brackets
    $('#winner_bracket_content').html('');
    $('#loser_bracket_content').html('');

    var elimination_heats = [];

    Object.values(ddr_heat_data).forEach(heat => {
        if (heat.class_id == race_class_id) {
            elimination_heats.push(heat);
        }
    });

    // loop through heats and build brackets
    console.log('There are ' + elimination_heats.length + ' heats');

    for (let i = 0; i < elimination_heats.length; i++) {
        const heat = elimination_heats[i];
        let html = '<div class="bracket_race">';
        html += '<div class="bracket_race_title">' + heat.displayname + '</div>';
        html += '<div class="bracket_race_pilots">';

        const filtered_slots = heat.slots.filter(slot => /*slot.seed_id*/true && slot.seed_rank);

        for (let j = 0; j < filtered_slots.length; j++) {
            const slot = filtered_slots[j];
            let pilot;

            if (slot.pilot_id === 0) {
                // try to get the pilot from completed heats
                if (slot.method == 1) {
                    // heat
                    const leaderboard_type = ddr_race_data.heats[slot.seed_id]?.leaderboard.meta.primary_leaderboard;
                    pilot = ddr_race_data.heats[slot.seed_id]?.leaderboard[leaderboard_type].find(p => p.position === slot.seed_rank);
                }
            } else {
                // pilot available
                pilot = ddr_pilot_data.find(p => p.pilot_id === slot.pilot_id);
            }

            if (pilot) {
                let flagImg = getFlagURL(pilot.pilot_id, ddr_pilot_data);
                let pilotImg = getPilotImgURL(pilot);

                html += '<div class="bracket_race_pilot">';

                html += '<div class="avatar"><img src="' + pilotImg + '"></div>';
                html += '<div class="flag"><img src="' + flagImg + '" alt="USA"></div>';
                html += '<div class="pilot_name">' + pilot.callsign + '</div>';

                html += '</div>';
            } else {
                let method_text = get_method_descriptor(ddr_pilot_data, ddr_heat_data, ddr_class_data, slot.method, slot.seed_id, slot.seed_rank, slot.pilot_id)
                html += '<div class="bracket_race_pilot">';
                html += '<div class="no_pilot">' + method_text + '</div>';
                html += '</div>';
            }
        }

        html += '</div>';
        html += '</div>';

        if (bracket_formats[race_bracket_type] != undefined) {
            let bracket_heat_info = bracket_formats[race_bracket_type][i];

            if (bracket_heat_info.type == "winner" || bracket_heat_info.type == "preliminary") {
                var column_counter = bracket_heat_info.column; 
                if ($('#bracket_column_' + column_counter).length == 0) {
                    $('#winner_bracket_content').append('<div id="bracket_column_'+column_counter+'" class="bracket_column"></div>');
                }
                $('#bracket_column_'+column_counter).append( html );
            } else {
                var column_counter = bracket_heat_info.column + 1;
                if ($('#bracket_column_loser_' + column_counter).length == 0) {
                    $('#loser_bracket_content').append('<div id="bracket_column_loser_'+column_counter+'" class="bracket_column"></div>');
                }
                $('#bracket_column_loser_'+column_counter).append( html );
            }
        }
    }
}

function get_method_descriptor(ddr_pilot_data, ddr_heat_data, ddr_class_data, method, seed, rank, pilot_id) {
    if (method == 0) { // pilot
        var pilot = ddr_pilot_data?.find(obj => {return obj.pilot_id == pilot_id});

        if (pilot) {
            return pilot.callsign;
        } else {
            return false;
        }
    } else if (method == 1) { // heat
        var heat = ddr_heat_data?.find(obj => {return obj.id == seed});

        if (heat) {
            return heat.displayname + " " + __('Rank') + " " + rank;
        } else {
            return false;
        }
    } else if (method == 2) { // class
        var race_class = ddr_class_data?.find(obj => {return obj.id == seed});

        if (race_class) {
            return race_class.displayname + " " + __('Rank') + " " + rank;
        } else {
            return false;
        }
    }
    return false;
}



/* utility functions */
function setsAreEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    return [...set1].every(item => set2.has(item));
}

