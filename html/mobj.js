const MOBJ_DCSN =
{
   NONE: 0,
   FREE_CHANGE_RIGHT: 1,
   PASS_RIGHT: 2,
   CHANGE_LEFT: 3,
   PASS_LEFT: 4,
   CHANGE_RIGHT: 5,
   PASS_SLOW_RIGHT: 6
};


class MovingObject
{
   //! static mobj counter, each mobj gets a unique id
   static id_cnt = 0;


   constructor(node = null)
   {
      //! description of this mobj
      this.desc = "Abstract implementation of a generic moving object.";
      //! pointer to list node
      this.node = node;
      //! id
      this.id = MovingObject.id_cnt++;
      //! current speed
      this.v_cur = 0.0;
      //! maximum speed
      this.v_max = 0.0;
      //! max speed difference on approaching a mobj ahead
      this.v_diff = 0.0;
      //! visibility range in time
      this.t_vis = 0.0;
      //! minimum distance in time
      this.t_min = 0.0;
      //! current position
      this.d_pos = 0.0;
      //! acceleration
      this._a_acc = 0.0;
      //! deceleration
      this._a_dec = 0.0;
      //! 1 if crash
      this.crash = 0;
      //! pointer to lane
      this.lane = null;
      //! frame of current state
      this.t_cur = 0;
      //! probability one would pass left
      this._p_pass_left = 0.90;
      //! probability one would pass right
      this._p_pass_right = 0.01;
      //! probabilty one would change back to the right lanes
      this._p_pref_right = 0.90;
      //! display color
      this.color = "grey";
      //! time frame of start of simulation measurement
      this.t_start = 0;
      //! time frame of end of simulation measurement
      this.t_end = 0;
      //! position of start of simulation measurement
      this.d_start = 0;
      //! position of end of simulation measurement
      this.d_end = 0;
      //! do measurement
      this.measure = 0;
      //! name/type of this mobj
      this.name = "MovingObject";
      //! length of mobj
      this.len = 0;
      //! time not going at max speed
      this.t_slow = 0;
      //! time of last lane changes, [0] -> right, [1] -> left
      this.t_chg = [0, 0];
      //! minimum time of lane back change
      this.t_chg_back = 10;
      //! latest decision
      this.dcsn = MOBJ_DCSN.NONE;
      //! time of decision
      this.t_dcsn = 0;
      //! minimum decision reevaluation periode
      this.t_eval = 1;
      //! speed at which one would also pass right with probability p_pass_left
      this.v_slow = MovingObject.kmh2ms(20);
      //! simulation distance
      this.distance = config_.DISTANCE;

      //! backup data
      this.old = {v_cur: this.v_cur, d_pos: this.d_pos, act: MOBJ_ACT.NONE, prev: null, next: null};
   }


   /*! This removes all references to help the GC.
    */
   destructor()
   {
      delete this.node;
      delete this.lane;
   }


   get p_pass_right()
   {
      return this._p_pass_right;
   }


   get p_pass_left()
   {
      return this._p_pass_left;
   }


   get p_pref_right()
   {
      return this._p_pref_right;
   }


   toString()
   {
      return this.constructor.name + ".id = " + this.id;
   }


   /*! Calculate visibility range in meters.
    */
   get d_vis()
   {
		return Math.max(this.v_cur * this.t_vis, config_.MOBJ_D_MIN);
   }


   /*! Calculate minimum distance in meters.
    */
   get d_min()
   {
		return Math.max(this.v_cur * this.t_min, config_.MOBJ_D_MIN);
   }


   get a_acc()
   {
      return this._a_acc / Math.exp(3.0 * this.v_cur / this.v_max )
   }


   get a_dec()
   {
      return this._a_dec;
   }


   get v_avg()
   {
      var t = this.t_end - this.t_start;
      return t > 0 ?  (this.d_end - this.d_start) / t : 0;
   }


   /*! Accelerate, but not more than v_max and never more than this.v_max.
    * @param v_max Maximum speed which shall not be exceeded.
    * @return The method returns MOBJ_ACT.ACC if it accelerated. If v_max is
    * already reached, MOBJ_ACT.NONE is returned.
    */
   accelerate(v_max)
   {
      // make sure max desired speed is not higher than possible
      if (v_max > this.v_max)
         v_max = this.v_max;

      // check if max speed already reached
      if (this.v_cur >= v_max)
         return MOBJ_ACT.NONE;

      // accelerate
      this.v_cur += this.a_acc;

      // make sure make speed is not exceeded after acceleration
      if (this.v_cur > v_max)
         this.v_cur = v_max;

      return MOBJ_ACT.ACC;
   }


   /*! Decelerate, but not less than v_min. The absolute minimum speed is 0.
    * The method makes sure that the current speed will never be less than 0.
    * @param v_min Minimum speed to reach.
    * @return The method returns MOBJ_ACT.DEC if the mobj was decelerated. In
    * case v_min was already reached before, MOBJ_ACT.NONE is returned.
    */
   decelerate(v_min)
   {
      // make sure mobj is not running backward
      if (v_min < 0)
         v_min = 0;

      // check if speed is already low enough
      if (this.v_cur <= v_min)
         return MOBJ_ACT.NONE;

      // decelerate
      this.v_cur += this.a_dec;

      // make sure car does not run backwards after deceleration
      if (this.v_cur < v_min)
         this.v_cur = v_min;

      return MOBJ_ACT.DEC;
   }


   /*! Save current state.
    */
   save()
   {
      this.old.v_cur = this.v_cur;
      this.old.d_pos = this.d_pos;
      this.old.prev = this.node.prev;
      this.old.next = this.node.next;
   }


   integrity(t_cur)
   {
      // integrity checks
      //console.log("id:" + this.id + ",v_cur:" + this.v_cur + ",d_pos:" + this.d_pos + ",t_cur:" + this.t_cur + ",lane:" + this.lane.id + ",crash:" + this.crash + ",");
      var diff = this.old.v_cur - this.v_cur;
      if (diff > 0 && diff < (this.a_dec - 0.1))
         console.log(-diff + " < dec " + this.a_dec);
      if (diff < 0 && -diff > (this.a_acc + 0.1))
         console.log(-diff + " > acc " + this.a_acc);
      if (this.old.d_pos > this.d_pos && this.d_pos != 0)
         console.log("moving error: " + this.old.d_pos + " > " + this.d_pos);
      if (this.t_cur && t_cur - this.t_cur > 1)
         console.log("timeskip: t_cur = " + t_cur + ", this.t_cur = " + this.t_cur);
      if (this.v_cur < 0)
         console.log("moving backwards: " + this.v_cur);
   }


   /*! Check if node is within minimum distance.
    * @param node Mobj to check.
    * @return Returns true if mobj is within minimum distance, otherwise false
    * is returned.
    */
   in_min_dist(mobj)
   {
      return this.d_pos > mobj.d_pos - mobj.len - this.d_min;
   }


   /*! Check if node is within visibility range.
    * @param node Mobj to check.
    * @return Returns true if mobj is within visibility range, otherwise false
    * is returned.
    */
   in_visibility(mobj)
   {
      return this.d_pos > mobj.d_pos - mobj.len - this.d_vis;
   }


   /*! This method makes a decision. If it is a new situation, i.e. the
    * decision to make is a different one than the latest, it decides with
    * probability p. If the decision is a reevaluation, i.e. it is the same
    * decision as the latest one, it checks if the previous decision is older
    * than t_eval and reevaluates it in that case.
    * @param dcsn Decision to make.
    * @param p Probability of a positiv decision.
    * @return It returns 1 if the decision was made positively (true),
    * otherwise 0 is returned.
    */
   decide(dcsn, p)
   {
      // if previous decition is the same as the current and the decision
      // period did not elapse, stick to it
      if (this.dcsn == dcsn && this.t_cur < this.t_dcsn + this.t_eval)
         return 0;

      // if decision is made positively
      if (SRandom.rand_ev(p))
      {
         this.dcsn = MOBJ_DCSN.NONE;
         return 1;
      }

      // store decision data in case of negative decision
      this.dcsn = dcsn;
      this.t_dcsn = this.t_cur;
      return 0;
   }


   /*! The function does the actual simulation of a mobj.
    * @param t_cur Current time frame to simulate. It is assumed that it is
    * stepping by 1.
    * @return The function returns 1 if a lane was changed, otherwise 0.
    */
	recalc(t_cur)
	{
      // check if current frame already calculated
      if (this.t_cur >= t_cur)
         return MOBJ_ACT.NONE;

      this.integrity(t_cur);

      // check if mobj passed start/finish line
      if (this.d_pos <= 0)
      {
         this.t_start = t_cur;
         this.d_start = this.d_pos;
      }
      else if (this.d_pos < this.distance)
      {
         this.t_end = t_cur;
         this.d_end = this.d_pos;
         this.measure = 1;
      }
      else
      {
         this.measure = 0;
      }

/*      if (this.old.d_pos <= 0 && this.d_pos >= 0)
      {
         this.t_init = t_cur;
         this.t_slow = 0;
      }*/

      this.save();
      this.t_cur = t_cur;

      // check for random mobj failure
      if (SRandom.rand_ev(config_.MOBJ_FAIL / 3600.0))
      {
         console.log(this.id + " fails");
         this.crash = 1;
      }

		// crashed mobjs don't do anything accept stopping immediately
		if (this.crash)
      {
         if (this.v_cur > 0)
            this.decelerate(0);
			return MOBJ_ACT.DEC;
      }

		// and move ahead
		this.d_pos += this.v_cur;

      // increase slow timer if not going at max speed
      if (this.measure && this.v_cur < this.v_max * 0.90)
         this.t_slow++;

      // get previous mobject
      var prev = this.node.prev.data;

		// detect crash and immediately stop
		if (prev != null && this.d_pos >= prev.d_pos)
		{
			console.log(this + " crashed into " + prev);
			this.crash = prev.crash = 1;
         this.d_pos = prev.d_pos;
         this.v_cur = prev.v_cur;
         if (this.a_dec < prev.a_dec)
            this.a_dec = prev.a_dec;
         this.decelerate(0);
         return MOBJ_ACT.CRASH;
		}

		// if there is no mobj ahead or the prev mobj is too far ahead
      if (prev == null || !this.in_visibility(prev))
      {
         // change lane to the right if possible
         if (this.decide(MOBJ_DCSN.FREE_CHANGE_RIGHT, this.p_pref_right) && this.change_right())
            return MOBJ_ACT.RIGHT;

         // loop over all lanes on the left
         for (var lane = this.lane.left; lane != null; lane = /*lane.left*/ null)
         {
            // get object ahead on the left lane
            var node = lane.ahead_of(this.d_pos);

            // continue at next lane if no mobj ahead
            if (node.data == null || !this.in_visibility(node.data))
               continue;

            // check if we simply pass (right of) the object
            if (node.data.crash || node.data.v_cur < this.v_slow || this.decide(MOBJ_DCSN.PASS_RIGHT, this.p_pass_right))
               break;

            // check if object on the left is within minimum distance
            if (this.in_min_dist(node.data))
            {
               // and decelerate in case
               this.decelerate(node.data.v_cur - this.v_diff);
               return MOBJ_ACT.DEC;
            }

            // move to the next lane on the left
            if (this.decide(MOBJ_DCSN.CHANGE_LEFT, this.p_pass_left) && this.change_left())
               return MOBJ_ACT.LEFT;

            // and decelerate in case
            this.decelerate(node.data.v_cur + this.v_diff);
            return MOBJ_ACT.DEC;
         }

         // otherwise speedup
         this.accelerate(this.v_max);
			return MOBJ_ACT.ACC;
      } //if (prev == null || !this.in_visibility(prev))

      // if previous is slower than we, if possible change lane to the left
      if (prev.v_cur < this.v_cur && this.decide(MOBJ_DCSN.PASS_LEFT, this.p_pass_left) && this.change_left())
         return MOBJ_ACT.LEFT;

      // prev mobj is too slow (or has crashed)
      if (prev.v_cur < this.v_slow)
      {
         // probably pass right
         if (this.decide(MOBJ_DCSN.PASS_SLOW_RIGHT, this.p_pass_left) && this.change_right())
            return MOBJ_ACT.RIGHT;
      }

      // or if possible change lane to the right
      if (this.decide(MOBJ_DCSN.CHANGE_RIGHT, this.p_pass_right) && this.change_right())
         return MOBJ_ACT.RIGHT;

      // approach speed difference will be negative if prev mobj is within
      // minimum distance, otherwise if it is in visibility range the approach
      // speed shall be positive.
      var d = this.in_min_dist(prev) ? -this.v_diff : this.v_diff;
      if (this.v_cur > prev.v_cur + d)
         return this.decelerate(prev.v_cur + d);
      if (this.v_cur < prev.v_cur + d)
         return this.accelerate(prev.v_cur + d);

      return MOBJ_ACT.NONE;
	}


   /*! Unlink this node from the current list and relink it behind node.
    */
   relink(node, lane)
   {
      //console.log(this + " changing lane to " + lane.id + " behind id = " + (node.data != null ? node.data.id : -1));
      // unlink this object from current list
      this.node.unlink();
      // append to new list behind node
      node.append(this.node);
      // change lane of this to new lane
      this.lane = lane;
   }


   /*! Check if lane change to dst lane is possible and execute change in case.
    * The possibility is evaluated by the distances of the neigboring mobjs and
    * if the minimum change-back-time t_chg_back has elapsed.
    * @param dst Destination lane.
    * @param p Probability one is intending to change the lane.
    * @return Returns 1 of lane was changed, otherwise 0.
    */
   change_lane(dst)
   {
      // safety check
      if (dst == null)
         return 0;

      if (this.lane == dst)
      {
         console.log("FATAL: this should never happen");
         return 0;
      }

      // get object ahead on the left lane
      var node = dst.ahead_of(this.d_pos);

      // check if minimum distance can be maintained
      if (node.data == null || !this.in_visibility(node.data))
      {
         // check if minimun distance of mobj behind on dst lane can be mained
         if (node.next.data == null || !node.next.data.in_min_dist(this))
         {
            // check if enough time elapsed from the last change
            if (this.t_cur <= this.t_chg[+(dst.id < this.lane.id)] + this.t_chg_back)
               return 0;

            // save current timestamp
            this.t_chg[+(dst.id > this.lane.id)] = this.t_cur;

            // change lane
            this.relink(node, dst);
            return 1;
         }
      }

      return 0;
   }


   change_right()
   {
      return this.change_lane(this.lane.right);
   }


   change_left()
   {
      return this.change_lane(this.lane.left);
   }


   static kmh2ms(x)
   {
      return x / 3.6;
   }


   static ms2kmh(x)
   {
      return x * 3.6;
   }


   /*! Set simulation parameters.
    */
   init(idata)
   {
      this.name = idata.name;

      this.v_max = idata.v_max_lo + (idata.v_max_hi - idata.v_max_lo) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(idata.v_diff);

      this.t_vis = idata.t_vis;
      this.t_min = idata.t_min;
      this._a_acc = idata.a_acc;
      this._a_dec = idata.a_dec;

      this.len = idata.len;

      this.color = idata.color;
   }


   /*! Return simulation data as a string.
    */
   sim_data()
   {
      var t = this.t_end - this.t_start;

      return "lane=" + this.lane.id + " name=\"" + this.name +"\" v_max=" + MovingObject.ms2kmh(this.v_max).toFixed(1) + " v_cur=" + MovingObject.ms2kmh(this.v_cur).toFixed(1) + " t=" + FormatTime.hms(t) + " t_start=" + this.t_start + " t_end=" + this.t_end + " t_slow=" + FormatTime.hms(this.t_slow) + " p_tslow=" + (100 * this.t_slow / (t)).toFixed(1) + "% v_avg=" + MovingObject.ms2kmh(this.v_avg).toFixed(1);
   }
}


class Car extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.desc = "Implementation of a regular car driver. Keeps right, passes left, moderate speed.";
      this.init(
         {
            name: "car",
            v_max_lo: MovingObject.kmh2ms(120),
            v_max_hi: MovingObject.kmh2ms(150),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 14,
            t_min: 2,
            a_acc: 1.5,
            a_dec: -3.0,
            len: 5,
            color: "grey"
         }
      );
   }
}


class Truck extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.desc = "Implementation of a regular truck driver. Keeps right only on the 1st and 2nd lane, passes left, typical truck speed.";
      this.init(
         {
            name: "truck",
            v_max_lo: MovingObject.kmh2ms(60),
            v_max_hi: MovingObject.kmh2ms(95),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 27,
            t_min: 4,
            a_acc: 0.5,
            a_dec: -1.0,
            len: 20,
            color: "blue"
         }
      );
   }


   // trucks will only use the 1st and 2nd lane, and occassionly the 3rd
   get p_pass_left()
   {
      if (this.lane.id < 2) return 0;
      return this.lane.id < 1 ? 0.3 : 1;
   }
}


class Bike extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.desc = "Implementation of a motorcycle. Goes pretty fast, high accelration and deceleration rates.";
      this.init(
         {
            name: "bike",
            v_max_lo: MovingObject.kmh2ms(100),
            v_max_hi: MovingObject.kmh2ms(170),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 10,
            t_min: 2,
            a_acc: 3.0,
            a_dec: -5.0,
            len: 2,
            color: "green"
         }
      );
   }
}


class BlockingCar extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.desc = "Implementation a \"blocking\" car. Lower average speed, keeps on the left and blocks lane, i.e. does go back right only ocassionally.";
      this.init(
         {
            name: "blocking",
            v_max_lo: MovingObject.kmh2ms(100),
            v_max_hi: MovingObject.kmh2ms(130),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 13,
            t_min: 2,
            a_acc: 1.5,
            a_dec: -3,
            len: 5,
            color: "red"
         }
      );
   }


   /*! Calculate probability to move back to the right for the blocking car.
    */
   get p_pref_right()
   {
      // higher right probability if it is on the left-most lane
      if (this.lane.left == null)
         return 0.3;

      // if there is no mobj behind or too far away don't change lane back
      if (this.node.next.data == null || this.node.next.data.d_pos < this.d_pos - this.d_vis)
         return 0.01;

      // otherwise change back with minimalistic probability
      return 0.05;
   }
}


class AggressiveCar extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.desc = "Agressive car driver. Goes at high speed, and accelerates and decelerates aggressively, occasionally passes right.";
      this.init(
         {
            name: "car",
            v_max_lo: MovingObject.kmh2ms(150),
            v_max_hi: MovingObject.kmh2ms(200),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 16,
            t_min: 2,
            a_acc: 1.8,
            a_dec: -3.6,
            len: 5,
            color: "#FF00FF"
         }
      );
      this._p_pass_right = 0.2;
   }
}


class MObjFactory
{
   static make(type = "car")
   {
      switch (type)
      {
         case "truck":
            return new Truck();
         case "bike":
            return new Bike();
         case "blocking":
            return new BlockingCar();
         case "aggressive":
            return new AggressiveCar();
         default:
            console.log("*** unknown mobj type: " + type);
            // intenionally there's no break
         case "car":
            return new Car();
      }
   }


   static desc(type)
   {
      var mobj = MObjFactory.make(type);
      return "Color: " + mobj.color + ": " + mobj.desc;
   }
}

