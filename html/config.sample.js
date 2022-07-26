/*! \file config.sample.js
 * This is a sample configuration file. Copy it to 'config.js' and adapt it to
 * your needs. Unset entries will be filled in with default values.
 *
 * \author Bernhard R. Fischer, <bf@abenteuerland.at>
 * \date 2022/07/26
 */

//! global configuration structure
var config =
{
   //! simulation frames per redraw
   //SIM_FPD: 1,
   //! display framerate
   //FPS: 25,
   //! maximum number of mobjs in the game (0 for unlimited)
   //MAX_MOBJS: 0,
   //! new mobjs do not enter befor MIN_ENTRY_POS meters
   //MIN_ENTRY_POS: 300,
   /*! Probability that a new mobj fills in if MIN_ENTRY_POS is ok. This controls
    * the traffic density. */
   //P_FILL_IN: 0.3,
   //! display size of mobjs
   //DSIZE: 6,
   //! maximum frames to calculate (0 for unlimited)
   //MAX_FRAMES: 0,
   //! use Math.random() as PRNG
   //USE_MATH_RANDOM: 0,
   //! mobj failure probability per hour
   //MOBJ_FAIL: 0.0,
   //! absolute minimum distance
   //MOBJ_D_MIN: 10,
   //! course distance
   //DISTANCE: 25000,
   //! number of lanes
   //NUM_LANES: 3,
   //! distribution of mobj types
   /*
   MOBJ_TYPES: [
      {type: "car", p: 0.35},
      {type: "truck", p: 0.3},
      {type: "bike", p: 0.01},
      {type: "blocking", p: 0.29},
      {type: "aggressive", p: 0.05},
   ]
   */
};

