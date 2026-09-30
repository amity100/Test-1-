"""
Clip table for the DAVID mocap library (CMU takes; start/end = seconds of motion after the T-pose frame, 120 fps).

name  : runtime id.   src: CMU take "<subject>_<trial>" (see cmu-mocap-index-text.txt for the descriptions)
loop  : (min, max) cycle length in seconds to search for a seamless loop; absent = one-shot
tags  : 'film' (opening film), 'game' (David gameplay), 'loco', 'idle', 'gesture', 'saul', 'samuel', 'army', 'elders'
Mirror any clip at runtime (play(name, { mirror: true })) for the other hand / the other turn direction.
"""

IDLE = (2.5, 6.0)

CLIPS = [
    # ------------------------------------------------------------------ locomotion (everyone)
    dict(name='walk', src='35_01', loop=(0.9, 1.3), tags=['loco', 'game', 'film'], desc='natural walk (subject 35, the cleanest CMU walker)'),
    dict(name='walk_b', src='16_15', loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk, subject 16 (variation)'),
    dict(name='walk_c', src='69_01', start=0.5, loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk forward, subject 69 (variation)'),
    dict(name='walk_d', src='07_01', loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk, subject 7 (variation)'),
    dict(name='jog', src='35_17', loop=(0.5, 0.95), tags=['loco', 'game'], desc='run/jog'),
    dict(name='run', src='16_55', loop=(0.5, 0.95), tags=['loco', 'game'], desc='run'),
    dict(name='sprint', src='09_01', loop=(0.45, 0.9), tags=['loco', 'game'], desc='fast run (subject 9)'),
    dict(name='start_walk', src='82_09', start=4.8, end=7.8, tags=['loco', 'game'], desc='stand -> confident walk'),
    dict(name='start_jog', src='104_06', start=0.0, end=2.4, tags=['loco', 'game'], desc='start jog'),
    dict(name='stop_jog', src='104_09', start=0.3, tags=['loco', 'game'], desc='jog -> stop'),
    dict(name='walk_stop', src='16_33', tags=['loco', 'game', 'film'], desc='slow walk, stop, stand'),
    dict(name='turn_left', src='69_16', start=0.0, end=1.7, tags=['loco', 'game'], desc='turn in place ~65 deg left (mirror = right)'),
    # ------------------------------------------------------------------ the army at Gilgal
    dict(name='march_c', src='91_19', start=2.8, end=6.8, loop=(0.9, 1.5), tags=['film', 'army', 'loco'], desc='march (subject 91)'),
    dict(name='march', src='20_06', loop=(0.9, 1.5), tags=['film', 'army', 'loco'], desc='soldiers march (subject 20)'),
    # ------------------------------------------------------------------ Saul, the king
    dict(name='walk_king', src='82_09', start=6.2, end=10.3, loop=(0.9, 1.5), tags=['film', 'saul', 'loco'], desc='confident, proud stride'),
    dict(name='walk_strong', src='137_42', start=2.0, end=6.2, loop=(1.0, 1.8), tags=['film', 'saul', 'loco'], desc='"strong man" heavy, broad walk'),
    dict(name='walk_heavy', src='17_08', start=1.0, end=5.0, loop=(1.0, 1.8), tags=['film', 'saul', 'loco'], desc='muscular heavyset person walk'),
    dict(name='walk_halt', src='82_14', start=0.5, end=7.5, tags=['film', 'saul', 'loco'], desc='walk, slow down, come to a halt, stand'),
    dict(name='idle_king', src='137_41', start=0.5, end=9.0, loop=IDLE, headPitch=0.3, tags=['film', 'saul', 'idle'], desc='"strong man" wait: broad stance'),
    dict(name='raise_arm_R', src='13_26', start=8.0, end=9.35, tags=['film', 'saul', 'army', 'gesture'], desc='right arm thrust up overhead (the spear raise; hold the peak with setSpeed 0)'),
    dict(name='cheer_arms', src='79_69', start=0.5, end=6.2, tags=['film', 'army', 'gesture'], desc='very happy: both arms up, cheering'),
    dict(name='cheer_reach', src='14_20', start=13.0, end=16.6, tags=['film', 'army', 'gesture'], desc='both arms reach up high'),
    dict(name='arms_high', src='05_12', start=8.0, end=11.3, tags=['film', 'army', 'gesture'], desc='one arm swept up high'),
    dict(name='cheer_walk', src='142_09', start=11.5, end=14.6, tags=['film', 'army', 'gesture'], desc='joyful walk with the arms up'),
    dict(name='grab_pull_R', src='18_05', tags=['film', 'saul', 'gesture'], desc='step in, seize with the right hand and pull (A pulls B by the elbow)'),
    dict(name='grab_R', src='56_02', start=10.5, end=14.0, tags=['film', 'saul', 'gesture'], desc='angry grab forward'),
    dict(name='reach_forward', src='15_06', start=0.5, end=3.6, tags=['film', 'gesture'], desc='lean forward, reach for'),
    dict(name='stagger_back', src='23_12', tags=['film', 'saul', 'gesture'], desc='bumped: stumble / recoil'),
    dict(name='flinch', src='77_09', start=0.5, end=3.2, tags=['film', 'gesture'], desc='duck / flinch away'),
    dict(name='recoil_surprised', src='120_15', start=2.5, end=6.6, tags=['film', 'gesture'], desc='surprised, backs away'),
    # ------------------------------------------------------------------ Samuel / the elders
    dict(name='walk_old', src='142_07', start=3.0, end=11.0, loop=(0.9, 1.9), tags=['film', 'samuel', 'elders', 'loco'], desc='elderly man walk, slow and upright'),
    dict(name='walk_old_hunched', src='137_33', start=2.0, end=8.0, loop=(1.0, 2.2), tags=['film', 'elders', 'loco'], desc='old man walk, stooped'),
    dict(name='old_turn_walk', src='142_07', start=17.5, end=23.5, tags=['film', 'samuel', 'loco'], desc='elderly man turns away and walks off'),
    dict(name='idle_old', src='137_32', start=0.5, end=9.0, loop=IDLE, tags=['film', 'samuel', 'elders', 'idle'], desc='old man wait'),
    dict(name='talk_gesture', src='18_08', start=1.0, end=13.0, tags=['film', 'elders', 'gesture'], desc='explaining with hand gestures (standing)'),
    dict(name='argue', src='18_10', start=0.0, end=3.0, tags=['film', 'elders', 'gesture'], desc='quarrel: angry hand gestures'),
    dict(name='point_directions', src='139_25', tags=['film', 'elders', 'gesture'], desc='giving directions, pointing'),
    dict(name='kneel', src='23_03', start=0.3, end=5.4, tags=['film', 'game', 'gesture'], desc='kneel down, stay, rise'),
    dict(name='kneel_hold', src='23_03', start=1.2, end=4.0, loop=(1.0, 2.6), tags=['film', 'game', 'idle'], desc='kneeling (loop)', lock=False),
    dict(name='kneel_bow', src='23_03', start=1.2, end=4.0, loop=(1.0, 2.6), spinePitch=0.5, headPitch=0.35, tags=['film', 'idle'], desc='kneeling, bowed low (kneel_hold + spine/head pitch): obeisance', lock=False),
    # ------------------------------------------------------------------ idles
    dict(name='idle_soldier', src='137_28', start=0.3, end=6.0, loop=IDLE, tags=['film', 'army', 'idle', 'game'], desc='normal wait'),
    dict(name='idle_shift', src='139_02', start=0.5, end=9.0, loop=IDLE, tags=['film', 'army', 'idle', 'game'], desc='shifting weight'),
    dict(name='idle_nervous', src='79_73', start=0.3, end=6.2, loop=(2.0, 5.0), tags=['film', 'idle'], desc='scared, fidgeting'),
    dict(name='idle_bus', src='40_10', start=0.5, end=9.0, loop=IDLE, tags=['film', 'idle', 'elders'], desc='wait for the bus: restless stand'),
    # ------------------------------------------------------------------ David gameplay actions
    dict(name='pickup_squat', src='69_70', start=1.3, end=4.8, tags=['game'], desc='step up, squat, pick up, rise'),
    dict(name='pickup_box', src='115_06', tags=['game'], desc='pick up from the ground bending the knees'),
    dict(name='throw_overhand', src='124_01', start=0.8, end=4.6, tags=['game'], desc='overhand throw (baseball pitch) - base for the sling release'),
    dict(name='throw_ball', src='141_11', start=0.3, end=3.2, tags=['game'], desc='overhand throw'),
    dict(name='look_around', src='139_01', start=4.5, end=9.0, tags=['game', 'idle'], desc='cautious look around'),
]
