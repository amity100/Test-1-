"""
Clip table for the DAVID mocap library (CMU takes; start/end = seconds of motion after the T-pose frame, 120 fps).

name  : runtime id.   src: CMU take "<subject>_<trial>" (see cmu-mocap-index-text.txt for the descriptions), or
        'rb:<stem>' = a Microsoft Rocketbox take (MIT; Assets/Animations/all_animations_max_motextr_*/<stem>.max.fbx,
        30 fps, tools/mocap/rocketbox.py) - start/end are seconds of that take
loop  : (min, max) cycle length in seconds to search for a seamless loop; absent = one-shot
tags  : 'film' (opening film), 'game' (David gameplay), 'loco', 'idle', 'gesture', 'saul', 'samuel', 'army', 'elders'
Mirror any clip at runtime (play(name, { mirror: true })) for the other hand / the other turn direction.
"""

IDLE = (2.5, 6.0)

# ship=False: a clip that neither the film nor the game plays (cut v2 audit, grep of src/ and dev/): it stays in the
# table and builds with `build_clips.py --all`, but is not shipped (the single-file build inlines every .binz).

CLIPS = [
    # ------------------------------------------------------------------ locomotion (everyone)
    dict(name='walk', src='35_01', loop=(0.9, 1.3), tags=['loco', 'game', 'film'], desc='natural walk (subject 35, the cleanest CMU walker)'),
    dict(name='walk_b', src='16_15', loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk, subject 16 (variation)'),
    dict(name='walk_c', src='69_01', start=0.5, loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk forward, subject 69 (variation)'),
    dict(name='walk_d', src='07_01', loop=(0.9, 1.4), tags=['loco', 'film', 'army'], desc='walk, subject 7 (variation)'),
    dict(name='jog', src='35_17', loop=(0.5, 0.95), tags=['loco', 'game'], desc='run/jog'),
    dict(name='run', src='16_55', loop=(0.5, 0.95), tags=['loco', 'game'], desc='run'),
    dict(name='sprint', src='09_01', loop=(0.45, 0.9), tags=['loco', 'game'], desc='fast run (subject 9)'),
    dict(name='start_walk', src='82_09', start=4.8, end=7.8, tags=['loco', 'game'], desc='stand -> confident walk', ship=False),
    dict(name='start_jog', src='104_06', start=0.0, end=2.4, tags=['loco', 'game'], desc='start jog', ship=False),
    dict(name='stop_jog', src='104_09', start=0.3, tags=['loco', 'game'], desc='jog -> stop', ship=False),
    dict(name='walk_stop', src='16_33', tags=['loco', 'game', 'film'], desc='slow walk, stop, stand', ship=False),
    dict(name='turn_left', src='69_16', start=0.0, end=1.7, tags=['loco', 'game'], desc='turn in place ~65 deg left (mirror = right)'),
    # ------------------------------------------------------------------ the army at Gilgal
    dict(name='march_c', src='91_19', start=2.8, end=6.8, loop=(0.9, 1.5), tags=['film', 'army', 'loco'], desc='march (subject 91)'),
    dict(name='march', src='20_06', loop=(0.9, 1.5), tags=['film', 'army', 'loco'], desc='soldiers march (subject 20)'),
    # ------------------------------------------------------------------ Saul, the king
    dict(name='walk_king', src='82_09', start=6.2, end=10.3, loop=(0.9, 1.5), tags=['film', 'saul', 'loco'], desc='confident, proud stride'),
    dict(name='walk_strong', src='137_42', start=2.0, end=6.2, loop=(1.0, 1.8), tags=['film', 'saul', 'loco'], desc='"strong man" heavy, broad walk', ship=False),
    dict(name='walk_heavy', src='17_08', start=1.0, end=5.0, loop=(1.0, 1.8), tags=['film', 'saul', 'loco'], desc='muscular heavyset person walk', ship=False),
    dict(name='walk_halt', src='82_14', start=0.5, end=7.5, tags=['film', 'saul', 'loco'], desc='walk, slow down, come to a halt, stand'),
    dict(name='idle_king', src='137_41', start=0.5, end=9.0, loop=IDLE, headPitch=0.3, tags=['film', 'saul', 'idle'], desc='"strong man" wait: broad stance'),
    dict(name='raise_arm_R', src='13_26', start=8.0, end=9.35, tags=['film', 'saul', 'army', 'gesture'], desc='right arm thrust up overhead (the spear raise; hold the peak with setSpeed 0)'),
    dict(name='cheer_arms', src='79_69', start=0.5, end=6.2, tags=['film', 'army', 'gesture'], desc='very happy: both arms up, cheering'),
    dict(name='cheer_reach', src='14_20', start=13.0, end=16.6, tags=['film', 'army', 'gesture'], desc='both arms reach up high'),
    dict(name='arms_high', src='05_12', start=8.0, end=11.3, tags=['film', 'army', 'gesture'], desc='one arm swept up high'),
    dict(name='cheer_walk', src='142_09', start=11.5, end=14.6, tags=['film', 'army', 'gesture'], desc='joyful walk with the arms up', ship=False),
    dict(name='grab_pull_R', src='18_05', tags=['film', 'saul', 'gesture'], desc='step in, seize with the right hand and pull (A pulls B by the elbow)'),
    dict(name='grab_R', src='56_02', start=10.5, end=14.0, tags=['film', 'saul', 'gesture'], desc='angry grab forward', ship=False),
    dict(name='reach_forward', src='15_06', start=0.5, end=3.6, tags=['film', 'gesture'], desc='lean forward, reach for', ship=False),
    dict(name='stagger_back', src='23_12', tags=['film', 'saul', 'gesture'], desc='bumped: stumble / recoil', ship=False),
    dict(name='flinch', src='77_09', start=0.5, end=3.2, tags=['film', 'gesture'], desc='duck / flinch away', ship=False),
    dict(name='recoil_surprised', src='120_15', start=2.5, end=6.6, tags=['film', 'gesture'], desc='surprised, backs away', ship=False),
    # ------------------------------------------------------------------ Samuel / the elders
    dict(name='walk_old', src='142_07', start=3.0, end=11.0, loop=(0.9, 1.9), tags=['film', 'samuel', 'elders', 'loco'], desc='elderly man walk, slow and upright'),
    dict(name='walk_old_hunched', src='137_33', start=2.0, end=8.0, loop=(1.0, 2.2), tags=['film', 'elders', 'loco'], desc='old man walk, stooped'),
    dict(name='old_turn_walk', src='142_07', start=17.5, end=23.5, tags=['film', 'samuel', 'loco'], desc='elderly man turns away and walks off'),
    dict(name='idle_old', src='137_32', start=0.5, end=9.0, loop=IDLE, tags=['film', 'samuel', 'elders', 'idle'], desc='old man wait', ship=False),
    dict(name='talk_gesture', src='18_08', start=1.0, end=13.0, tags=['film', 'elders', 'gesture'], desc='explaining with hand gestures (standing)'),
    dict(name='argue', src='18_10', start=0.0, end=3.0, tags=['film', 'elders', 'gesture'], desc='quarrel: angry hand gestures'),
    dict(name='point_directions', src='139_25', tags=['film', 'elders', 'gesture'], desc='giving directions, pointing'),
    dict(name='kneel', src='23_03', start=0.3, end=5.4, tags=['film', 'game', 'gesture'], desc='kneel down, stay, rise'),
    dict(name='kneel_hold', src='23_03', start=1.2, end=4.0, loop=(1.0, 2.6), tags=['film', 'game', 'idle'], desc='kneeling (loop)', lock=False),
    dict(name='kneel_bow', src='23_03', start=1.2, end=4.0, loop=(1.0, 2.6), spinePitch=0.5, headPitch=0.35, tags=['film', 'idle'], desc='kneeling, bowed low (kneel_hold + spine/head pitch): obeisance', lock=False, ship=False),
    # ------------------------------------------------------------------ idles
    dict(name='idle_soldier', src='137_28', start=0.3, end=6.0, loop=IDLE, tags=['film', 'army', 'idle', 'game'], desc='normal wait'),
    dict(name='idle_shift', src='139_02', start=0.5, end=9.0, loop=IDLE, tags=['film', 'army', 'idle', 'game'], desc='shifting weight'),
    dict(name='idle_nervous', src='79_73', start=0.3, end=6.2, loop=(2.0, 5.0), tags=['film', 'idle'], desc='scared, fidgeting', ship=False),
    dict(name='idle_bus', src='40_10', start=0.5, end=9.0, loop=IDLE, tags=['film', 'idle', 'elders'], desc='wait for the bus: restless stand'),
    # ------------------------------------------------------------------ David gameplay actions
    dict(name='pickup_squat', src='69_70', start=1.3, end=4.8, tags=['game'], desc='step up, squat, pick up, rise', ship=False),
    dict(name='pickup_box', src='115_06', tags=['game'], desc='pick up from the ground bending the knees'),
    dict(name='throw_overhand', src='124_01', start=0.8, end=4.6, tags=['game'], desc='overhand throw (baseball pitch) - base for the sling release', ship=False),
    dict(name='throw_ball', src='141_11', start=0.3, end=3.2, tags=['game'], desc='overhand throw'),
    dict(name='look_around', src='139_01', start=4.5, end=9.0, tags=['game', 'idle'], desc='cautious look around', ship=False),
    # ================================================================== Microsoft Rocketbox (MIT) - cut v2 of the film
    # (ship=False: imported and checked in contact sheets, not used by the film or the game yet -> not shipped;
    #  build with --all to ship them)
    # ---- the army's ROAR at Gilgal (every soldier a different take, offset 0-0.4 s): one-shots that end arms-high
    dict(name='cheer_1', src='rb:m_cheer_02', start=0.0, end=2.9, tags=['film', 'army', 'gesture', 'rb'], desc='roar: both fists thrust high, pumping (Rocketbox m_cheer_02)'),
    dict(name='cheer_2', src='rb:m_cheer_04', start=0.2, end=3.8, tags=['film', 'army', 'gesture', 'rb'], desc='roar: both arms up and held (Rocketbox m_cheer_04)'),
    dict(name='cheer_3', src='rb:m_cheer_03', start=0.3, end=3.0, tags=['film', 'army', 'gesture', 'rb'], desc='roar: right fist raised (Rocketbox m_cheer_03)'),
    dict(name='cheer_4', src='rb:m_cheer_05', start=0.2, end=3.0, tags=['film', 'army', 'gesture', 'rb'], desc='roar: right fist pumping (Rocketbox m_cheer_05)'),
    dict(name='cheer_5', src='rb:m_cheer_01', start=11.0, end=14.3, tags=['film', 'army', 'gesture', 'rb'], desc='roar: fists up to the head, shouting (Rocketbox m_cheer_01)'),
    # ---- walks (the king's stride, the army's variety, Samuel's step)
    dict(name='walk_cool', src='rb:m_walk_cool_01', loop=(1.1, 1.3), loopWhole=True, tags=['film', 'saul', 'loco', 'rb'], desc="a proud, regal stride (Rocketbox m_walk_cool_01)"),
    dict(name='walk_cool_b', src='rb:m_walk_cool_02', loop=(1.0, 1.17), loopWhole=True, tags=['film', 'saul', 'army', 'loco', 'rb'], desc='a confident stride, longer steps (Rocketbox m_walk_cool_02)'),
    dict(name='walk_slow', src='rb:m_walk_slow_01', loop=(1.3, 1.5), loopWhole=True, tags=['film', 'samuel', 'elders', 'loco', 'rb'], desc='slow, upright walk (Rocketbox m_walk_slow_01)'),
    dict(name='walk_n1', src='rb:m_walk_neutral_01', loop=(1.05, 1.23), loopWhole=True, tags=['film', 'army', 'loco', 'rb'], desc='walk (Rocketbox m_walk_neutral_01)'),
    dict(name='walk_n2', src='rb:m_walk_neutral_02', loop=(0.95, 1.1), loopWhole=True, tags=['film', 'army', 'loco', 'rb'], desc='walk (Rocketbox m_walk_neutral_02)'),
    dict(name='walk_stop_rb', src='rb:m_walk_stop', tags=['film', 'saul', 'loco', 'rb'], desc='walk, halt in two steps, stand (Rocketbox m_walk_stop)'),
    dict(name='turn_go_L', src='rb:m_turn_left_180_to_walk', tags=['film', 'samuel', 'loco', 'rb'], desc='turn 180 deg to the left into a walk away (Rocketbox m_turn_left_180_to_walk)'),
    dict(name='turn_go_R', src='rb:m_turn_right_180_to_walk', tags=['film', 'samuel', 'loco', 'rb'], desc='turn 180 deg to the right into a walk away (Rocketbox m_turn_right_180_to_walk)', ship=False),
    dict(name='turn_180_L', src='rb:m_turn_left_180', tags=['film', 'loco', 'rb'], desc='turn 180 deg to the left on the spot (Rocketbox m_turn_left_180)', ship=False),
    # ---- the elders at Ramah, Samuel
    dict(name='stand_up', src='rb:m_sit_stand_up_chair_01', tags=['film', 'elders', 'gesture', 'rb'], desc='rise from a seat (Rocketbox m_sit_stand_up_chair_01)', lock=False),
    dict(name='talk_angry', src='rb:m_gestic_talk_angry_01', start=1.5, end=7.5, tags=['film', 'elders', 'gesture', 'rb'], desc='angry demand: the arm raised high at 2.5 s (Rocketbox m_gestic_talk_angry_01)'),
    dict(name='talk_excited', src='rb:m_gestic_talk_excited_02', start=1.5, end=7.5, tags=['film', 'elders', 'gesture', 'rb'], desc='excited talk, both hands (Rocketbox m_gestic_talk_excited_02)'),
    dict(name='talk_sad', src='rb:m_gestic_talk_sad_01', start=4.5, end=10.5, tags=['film', 'elders', 'samuel', 'gesture', 'rb'], desc='grave, sad talk (Rocketbox m_gestic_talk_sad_01)', ship=False),
    dict(name='listen_deny', src='rb:m_gestic_listen_deny_03', start=0.0, end=4.1, tags=['film', 'samuel', 'elders', 'gesture', 'rb'], desc='listens, shakes the head, turns away (Rocketbox m_gestic_listen_deny_03)', ship=False),
    dict(name='listen_deny_b', src='rb:m_gestic_listen_deny_02', start=0.0, end=3.3, tags=['film', 'samuel', 'gesture', 'rb'], desc='listens, turns the head away (Rocketbox m_gestic_listen_deny_02)'),
    dict(name='listen_sad', src='rb:m_gestic_listen_sad_01', start=3.0, end=10.0, loop=(2.5, 6.0), tags=['film', 'samuel', 'idle', 'rb'], desc='sad, still listening (Rocketbox m_gestic_listen_sad_01)'),
    dict(name='listen_angry', src='rb:m_gestic_listen_angry_01', start=1.0, end=6.0, tags=['film', 'elders', 'gesture', 'rb'], desc='listens with crossed arms, angry (Rocketbox m_gestic_listen_angry_01)'),
    # ---- idles with life (breath, weight shifts, looking around)
    dict(name='idle_breathe', src='rb:m_idle_breathe_02', start=0.0, end=10.0, loop=(2.5, 6.0), tags=['film', 'idle', 'saul', 'rb'], desc='deep breathing stand (Rocketbox m_idle_breathe_02)'),
    dict(name='idle_n1', src='rb:m_idle_neutral_01', start=0.0, end=11.6, loop=(3.0, 7.0), tags=['film', 'idle', 'army', 'elders', 'rb'], desc='neutral stand, weight shifts (Rocketbox m_idle_neutral_01)'),
    dict(name='idle_n2', src='rb:m_idle_neutral_02', start=0.0, end=15.4, loop=(3.0, 7.0), tags=['film', 'idle', 'army', 'rb'], desc='neutral stand (Rocketbox m_idle_neutral_02)'),
    dict(name='idle_angry', src='rb:m_idle_angry_02', start=0.3, end=8.0, loop=(3.0, 7.0), tags=['film', 'idle', 'elders', 'rb'], desc='agitated stand, head turns (Rocketbox m_idle_angry_02)'),
    dict(name='look_around_L', src='rb:m_idle_look_around_01', start=0.3, end=4.4, tags=['film', 'army', 'gesture', 'rb'], desc='turns to look to the right and back (Rocketbox m_idle_look_around_01)'),
    dict(name='look_around_R', src='rb:m_idle_look_around_02', start=0.3, end=4.3, tags=['film', 'army', 'gesture', 'rb'], desc='turns to look to the left and back (Rocketbox m_idle_look_around_02)'),
    dict(name='crouch_in', src='rb:m_crouch_in', tags=['film', 'game', 'gesture', 'rb'], desc='crouch down (Rocketbox m_crouch_in)', ship=False),
    dict(name='crouch_idle', src='rb:m_crouch_idle', loop=(2.0, 5.0), tags=['film', 'game', 'idle', 'rb'], desc='crouching (Rocketbox m_crouch_idle)', lock=False, ship=False),
    dict(name='crouch_out', src='rb:m_crouch_out', tags=['film', 'game', 'gesture', 'rb'], desc='rise from a crouch (Rocketbox m_crouch_out)', ship=False),
]
