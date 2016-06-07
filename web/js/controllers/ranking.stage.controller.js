'use strict';
var $ = require('jquery');
var angular = require('angular');
var jsPsych = require('jspsych');
var colley = require('colley-rankings');
var async = require('async');
var common = require('../../../common/common');

module.exports = function($scope, experimentService) {

    rankingStage(experimentService.expData, function(err, data){
        experimentService.expData = data;
    });

    function rankingStage(expData, callback){
        var timeline = [];
        var instructionPages = _.map(expData.ranking_instructions, function(img){
            return '<img style="max-height: 100%; max-width: 100%; height: auto;" src="' + expData.resourceUrl + '/images/instructions/' + img + '" />'
        });
        timeline.push(
            {
                type: 'instructions',
                pages: instructionPages,
                key_forward: ' ',
                allow_backward: false,
                show_clickable_nav: false
            }
        );
        var stimuli = expData.stimuli;
        var stimuliWins = _.map(expData.stimuli, function (stim_item){ return $.extend(stim_item, { wins: 0, losses: 0 }) });

        var l = common.createRandomCompetitions(stimuli, expData.rankingTrials);

        var clly = colley(stimuli.length);

        var ranking_result = {};
        ranking_result.trials = [];
        ranking_result.items_ranking = [];
        ranking_result.trial_count = 0;

        var leftInstruction = "";
        var rightInstruction = "";
        if (expData.showKeyInstruction) {
            leftInstruction = _.toUpper(expData.ranking_keys.left);
            rightInstruction = _.toUpper(expData.ranking_keys.right);
        }

        var competitions_stimuli = [];
        for (var i = 0; i < l.list1.length; i++){
            competitions_stimuli.push({
                    timeline: [
                        {
                            type: 'single-stim',
                            choices: [expData.ranking_keys.left, expData.ranking_keys.right],
                            timing_response: expData.ranking_rt,
                            is_html: true,
                            data: {
                                stim1: l.list1[i],
                                stim2: l.list2[i],
                                nStim1: _.indexOf(stimuli, l.list1[i]),
                                nStim2: _.indexOf(stimuli, l.list2[i])
                            },
                            stimulus:
                            '<img class="leftStim" src="' + expData.resourceUrl + '/images/stimuli/' + l.list1[i] + '" />' +
                            '<text class="leftStimInstruction">' + leftInstruction + '</text>' +
                            '<text class="fixationText">+</text>' +
                            '<img class="rightStim" src="' + expData.resourceUrl + '/images/stimuli/' + l.list2[i] + '" />' +
                            '<text class="rightStimInstruction">' + rightInstruction + '</text>',
                            on_finish: function (data) {
                                var response = 'x';
                                if (data.key_press > 0) {
                                    if (expData.ranking_key_codes.left == data.key_press) {
                                        response = expData.ranking_keys.left;
                                        stimuliWins[data.nStim1].wins += 1;
                                        stimuliWins[data.nStim2].losses += 1;
                                        clly.addGame(data.nStim1, data.nStim2);
                                    } else {
                                        response = expData.ranking_keys.right;
                                        stimuliWins[data.nStim1].losses += 1;
                                        stimuliWins[data.nStim2].wins += 1;
                                        clly.addGame(data.nStim2, data.nStim1);
                                    }
                                }
                                ranking_result.trial_count = ranking_result.trial_count + 1;
                                ranking_result.trials.push({
                                    runtrial: ranking_result.trial_count,
                                    onsettime: data.onset_time,
                                    ImageLeft: data.stim1,
                                    ImageRight: data.stim2,
                                    StimNumLeft: data.nStim1,
                                    StimNumRight: data.nStim2,
                                    Response: response,
                                    RT: data.rt
                                });
                            }
                        },
                        {
                            conditional_function: function () {
                                var data = jsPsych.data.getLastTrialData();
                                return data.key_press < 0;
                            },
                            timeline: [{
                                type: 'multi-stim-multi-response',
                                choices: [[], []],
                                stimuli: [
                                    '<p style="font-size: 32px; text-align:center;">You must respond faster</p>',
                                    '<text class="fixationText"">+</text>'],
                                is_html: true,
                                timing_stim: [500, -1],
                                timing_response: function () {
                                    var prevTrial = jsPsych.data.getLastTrialData();
                                    var prevTrialTime = _.min([prevTrial.rt, expData.ranking_rt]);
                                    return expData.ranking_total_time - prevTrialTime;
                                }
                            }]
                        },
                        {
                            conditional_function: function () {
                                var data = jsPsych.data.getLastTrialData();
                                return data.key_press >= 0;
                            },
                            timeline: [
                                {
                                    type: 'multi-stim-multi-response',
                                    choices: [[], []],
                                    stimuli: function(){
                                        var style1 = '';
                                        var style2 = '';
                                        var data = jsPsych.data.getLastTrialData();

                                        if (expData.ranking_key_codes.left == data.key_press) {
                                            style1 = 'background: green;'; //'border: solid 5px green; margin: -5px;';
                                        } else {
                                            style2 = 'background: green;'; //'border: solid 5px green; margin: -5px;';
                                        }

                                        return [
                                            '<img class="leftStim" src="' + expData.resourceUrl + '/images/stimuli/' + data.stim1 + '" id="jspsych-single-stim-stimulus" style="' + style1 + '"/>' +
                                            '<text class="fixationText">+</text>' +
                                            '<img class="rightStim" src="' + expData.resourceUrl + '/images/stimuli/' + data.stim2 + '" id="jspsych-single-stim-stimulus" style="' + style2 + '" />',
                                            '<text class="fixationText">+</text>'
                                        ];
                                    },
                                    is_html: true,
                                    timing_stim: [500, -1],
                                    timing_response: function () {
                                        var prevTrial = jsPsych.data.getLastTrialData();
                                        var prevTrialTime = _.min([prevTrial.rt, expData.ranking_rt]);
                                        return expData.ranking_total_time - prevTrialTime;
                                    }
                                }
                            ]
                        }]
                }
            );
        }

        var rankingTrials = {
            timeline: competitions_stimuli
        };

        timeline.push(rankingTrials);

        timeline.push({
            type: 'call-function',
            func: function(){
                var rankings = clly.solve().array;
                var stimuli_ranking = [];
                for (var i=0; i < rankings.length; i++){
                    stimuli_ranking.push({
                        StimName: stimuli[i],
                        Wins: stimuliWins[i].wins,
                        Losses: stimuliWins[i].losses,
                        StimNum: i+1,
                        Rank: rankings[i]
                    });
                }
                ranking_result.items_ranking = _.orderBy(stimuli_ranking,'Rank','desc')
            }
        });


        if (!expData.is_demo) {
            timeline.push(common.waitForServerResponseTrial('/exp/rankings',
                {
                    data: ranking_result,
                    waitText: 'Loading next stage...',
                    retry_interval: 2000,
                    cb: function (data, textSstatus, xhr) {
                        if (xhr.status == 201) {
                            var redirectionUrl = xhr.getResponseHeader('Location');
                            window.location.replace(redirectionUrl);
                        }
                    }
                }));
        }

        timeline.push({
                type: 'instructions',
                pages: [
                    'Click next to continue'
                ],
                show_clickable_nav: true,
                on_finish: function (data) {
                    expData.sortedStimuli = _.orderBy(ranking_result.items_ranking, 'rank', 'desc');
                    common.forceFullScreen();
                    //jsPsych.endExperiment('End of ranking stage');
                    callback(null, expData);  // TODO - fix sync issue with next stage!!
                }
            },
            //{
            //    type: 'call-function',
            //    func: function(){
            //        expData.sortedStimuli = _.orderBy(ranking_result.items_ranking, 'rank', 'desc');
            //        common.forceFullScreen();
            //        //jsPsych.endExperiment('End of ranking stage');
            //        callback(null, expData);  // TODO - fix sync issue with next stage!!
            //    }
            //},
            {
                type: 'instructions',
                pages: [
                    'next stage will load shortly. Please wait...'
                ],
                show_clickable_nav: false,
                allow_keys: false
            });

        var images = [];
        stimuli.forEach(function(stim){
            images.push(expData.resourceUrl + '/images/stimuli/' + stim);
        });

        jsPsych.pluginAPI.preloadImages(images, function(){
            jsPsych.data.clear();
            jsPsych.init_data({
                display_element: $('#jspsych-target'), //($element),
                auto_preload: false,
                timeline: timeline,
                fullscreen: false,
                default_iti: 0,
                on_trial_finish: function(){
                    common.forceFullScreen();
                }
            });
        });
    }
};