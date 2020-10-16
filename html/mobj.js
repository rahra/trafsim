class MovingObject
{
   //! static mobj counter, each mobj gets a unique id
   static id_cnt = 0;


   constructor(node = null)
   {
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
      this.a_acc = 0.0;
      //! deceleration
      this.a_dec = 0.0;
      //! 1 if crash
      this.crash = 0;
      //! pointer to lane
      this.lane = null;
      //! frame of current state
      this.t_cur = 0;
      //! probability one would pass left
      this._p_pass_left = 1.0;
      //! probability one would pass right
      this._p_pass_right = 0.0;
      //! probabilty one would change back to the right lanes
      this._p_right = 1.0;
      //! display color
      this.color = "grey";
      //! initial time frame (should be set on creation)
      this.t_init = 0;
      //! name/type of this mobj
      this.name = "MovingObject";
      //! length of mobj
      this.len = 0;

      //! backup data
      this.old = {v_cur: this.v_cur, d_pos: this.d_pos, act: MOBJ_ACT.NONE, prev: null, next: null};
   }


   get p_pass_right()
   {
      return this._p_pass_right;
   }


   get p_pass_left()
   {
      return this._p_pass_left;
   }


   get p_right()
   {
      return this._p_right;
   }


   toString()
   {
      return this.constructor.name + ".id = " + this.id;
   }


   /*! Calculate visibility range in meters.
    */
   get d_vis()
   {
		return Math.max(this.v_cur * this.t_vis, MOBJ_D_MIN);
   }


   /*! Calculate minimum distance in meters.
    */
   get d_min()
   {
		return Math.max(this.v_cur * this.t_min, MOBJ_D_MIN);
   }


   /*! Accelerate, but not more than v_max.
    */
   accelerate(v_max)
   {
      // make sure max desired speed is not higher than possible
      if (v_max > this.v_max)
         v_max = this.v_max;

      // check if max speed already reached
      if (this.v_cur >= v_max)
         return;

      // accelerate
      this.v_cur += this.a_acc;

      // make sure make speed is not exceeded after acceleration
      if (this.v_cur > v_max)
         this.v_cur = v_max;
   }


   /*! Decelerate, but not less than v_min.
    */
   decelerate(v_min)
   {
      // make sure mobj is not running backward
      if (v_min < 0)
         v_min = 0;

      // check if speed is already low enough
      if (this.v_cur <= v_min)
         return;

      // decelerate
      this.v_cur -= this.a_dec;

      // make sure car does not run backwards after deceleration
      if (this.v_cur < v_min)
         this.v_cur = v_min;
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
      if (diff > 0 && diff > (this.a_dec + 0.1))
         console.log(diff + " > dec " + this.a_dec);
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
      this.save();
      this.t_cur = t_cur;

      // check for random mobj failure
      if (SRandom.rand_ev(MOBJ_FAIL / 3600.0))
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

      // get previous mobject
      var prev = this.node.prev.data;

		// if there is no mobj ahead or the prev mobj is too far ahead
      if (prev == null || !this.in_visibility(prev))
      {
         // change lane to the right if possible
         if (SRandom.rand_ev(this.p_right) && this.change_right())
            return MOBJ_ACT.RIGHT;

         // loop over all lanes on the left
         for (var lane = this.lane.left; lane != null; lane = lane.left)
         {
            // get object ahead on the left lane
            var node = lane.ahead_of(this.d_pos);

            // continue at next lane if no mobj ahead
            if (node.data == null || node.data.crash || SRandom.rand_ev(this.p_pass_right))
               continue;

            // check if object on the left is within visibilty
            if (this.in_visibility(node.data))
            {
               // and decelerate in case
               this.decelerate(node.data.v_cur + this.v_diff);
               return MOBJ_ACT.DEC;
            }

            // check if object on the left is within visibilty
            if (this.in_min_dist(node.data))
            {
               // and decelerate in case
               this.decelerate(node.data.v_cur - this.v_diff);
               return MOBJ_ACT.DEC;
            }
         }

         // otherwise speedup
         this.accelerate(this.v_max);
			return MOBJ_ACT.ACC;
      }

		// detect crash and immediately stop
		if (this.d_pos >= prev.d_pos)
		{
			console.log(this + " crashed into " + prev);
			this.crash = prev.crash = 1;
         this.d_pos = prev.d_pos;
         this.v_cur = prev.v_cur;
         if (this.a_dec > prev.a_dec)
            this.a_dec = prev.a_dec;
         this.decelerate(0);
         return MOBJ_ACT.CRASH;
		}

      // if possible change lane to the left
      if ((prev.crash || SRandom.rand_ev(this.p_pass_left)) && this.change_left())
         return MOBJ_ACT.LEFT;

      // or if possible change lane to the right
      if ((prev.crash || SRandom.rand_ev(this.p_pass_right)) && this.change_right())
         return MOBJ_ACT.RIGHT;

		// if minimum distance is not maintained
      if (this.in_min_dist(prev))
         this.decelerate(prev.v_cur - this.v_diff);
		// if prev mobj is within visibility
      else
         this.decelerate(prev.v_cur + this.v_diff);

      return MOBJ_ACT.DEC;
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


   /*! Check if lane change to dst lane ist possible and execute change in case.
    * @param dst Destination lane.
    * @param p Probability one is intending to change the lane.
    * @return Returns 1 of lane was changed, otherwise 0.
    */
   change_lane(dst)
   {
      // safety check
      if (dst == null)
         return 0;

      // get object ahead on the left lane
      var node = dst.ahead_of(this.d_pos);

      // check if minimum distance can be maintained
      if (node.data == null || !this.in_visibility(node.data))
      {
         // check if minimun distance of mobj behind on dst lane can be mained
         if (node.next.data == null || !node.next.data.in_min_dist(this))
         {
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


   /*! Set simulation data.
    */
   init(idata)
   {
      this.name = idata.name;

      this.v_max = idata.v_max_lo + (idata.v_max_hi - idata.v_max_lo) * SRandom.rand();
      this.v_cur = this.v_max - (idata.v_max_hi - idata.v_max_lo) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(idata.v_diff);

      this.t_vis = idata.t_vis;
      this.t_min = idata.t_min;
      this.a_acc = idata.a_acc;
      this.a_dec = idata.a_dec;

      this.len = idata.len;

      this.color = idata.color;
   }
}


class Car extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.init(
         {
            name: "car",
            v_max_lo: MovingObject.kmh2ms(100),
            v_max_hi: MovingObject.kmh2ms(150),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 14,
            t_min: 2,
            a_acc: 1.5,
            a_dec: 3.0,
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
      this.init(
         {
            name: "truck",
            v_max_lo: MovingObject.kmh2ms(60),
            v_max_hi: MovingObject.kmh2ms(95),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 27,
            t_min: 4,
            a_acc: 0.5,
            a_dec: 1.0,
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
      this.init(
         {
            name: "bike",
            v_max_lo: MovingObject.kmh2ms(100),
            v_max_hi: MovingObject.kmh2ms(170),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 10,
            t_min: 2,
            a_acc: 3.0,
            a_dec: 5.0,
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
      this.init(
         {
            name: "blocking",
            v_max_lo: MovingObject.kmh2ms(100),
            v_max_hi: MovingObject.kmh2ms(130),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 13,
            t_min: 2,
            a_acc: 1.5,
            a_dec: 3,
            len: 5,
            color: "red"
         }
      );
   }


   /*! Calculate probability to move back to the right for the blocking car.
    */
   get p_right()
   {
      // higher right probability if it is on the left-most lane
      if (this.lane.left == null)
         return 0.3;

      // if there is no mobj behind or too far away don't change lane back
      if (this.node.next.data == null || this.node.next.data.d_pos < this.d_pos - this.d_vis)
         return 0;

      // otherwise change back with minimalistic probability
      return 0.05;
   }
}


class AggressiveCar extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.init(
         {
            name: "car",
            v_max_lo: MovingObject.kmh2ms(150),
            v_max_hi: MovingObject.kmh2ms(200),
            v_diff: MovingObject.kmh2ms(5),
            t_vis: 16,
            t_min: 2,
            a_acc: 1.8,
            a_dec: 3.6,
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
}

