class MovingObject
{
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
      //! probabilty one would pass left
      this._p_pass = 1.0;
      //! probabilty one would change back to the right lanes
      this._p_right = 1.0;
      //! display color
      this.color = "grey";
      //! initial time frame (should be set on creation)
      this.t_init = 0;

      //! backup data
      this.old = {v_cur: this.v_cur, d_pos: this.d_pos, prev: null, next: null};
   }


   get p_pass()
   {
      return this._p_pass;
   }


   get p_right()
   {
      return this._p_right;
   }


   toString()
   {
      return "mobj id = " + this.id;
   }


   /*! Calculate visibility range in meters.
    */
   get d_vis()
   {
		return this.v_cur * this.t_vis;
   }


   /*! Calculate minimum distance in meters.
    */
   get d_min()
   {
		return this.v_cur * this.t_min;
   }


   /*! Accelerate, but not more than v_max.
    */
   accelerate(v_max)
   {
      // increase speed to the max if not already reached
      this.v_cur = Math.min(this.v_cur + this.a_acc, Math.min(v_max, this.v_max));
   }


   /*! Decelerate, but not less than v_min.
    */
   decelerate(v_min)
   {
      this.v_cur = Math.max(this.v_cur - this.a_dec, v_min, 0);
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


   log_data()
   {
      return "id:" + this.id + ",v_cur:" + this.v_cur + ",d_pos:" + this.d_pos + ",t_cur:" + this.t_cur + ",lane:" + this.lane.id + ",crash:" + this.crash + ",";
   }


	recalc(t_cur)
	{
      // check if current frame already calculated
      if (this.t_cur >= t_cur)
         return;

      //console.log(this.log_data());
      this.save();
      this.t_cur = t_cur;

      if (SRandom.rand() < MOBJ_FAIL)
      {
         console.log(this.id + " fails");
         this.crash = 1;
      }

		// crashed mobjs don't do anything accept stopping immediately
		if (this.crash)
			return;

		// and move ahead
		this.d_pos += this.v_cur;

      // get previous mobject
      var prev = this.node.prev.data;

		// if there is no mobj ahead or the prev mobj is too far ahead
      if (prev == null || this.d_pos < prev.d_pos - this.d_vis)
      {
         // change lane to the right if possible
         if (!this.change_back())
            // otherwise speedup
			   this.accelerate(this.v_max);
			return;
      }

		// detect crash and immediately stop
		if (this.d_pos >= prev.d_pos)
		{
			console.log(this + " crashed into " + prev);
			this.crash = prev.crash = 1;
         this.d_pos = prev.d_pos;
			this.v_cur = prev.v_cur = 0;
         return;
		}

		// if minimum distance is not maintained
		if (this.d_pos > prev.d_pos - this.d_min)
		{
         // if possible change lane
         if (!this.pass())
            // otherwise decelerate
			   this.decelerate(prev.v_cur - this.v_diff);
		}
		// if prev mobj is within visibility
		else if (this.d_pos > prev.d_pos - this.d_vis)
		{
			// if approach speed difference is higher than valid, decelerate
         if (!this.pass() && this.v_cur - prev.v_cur > this.v_diff)
				this.decelerate(prev.v_cur + this.v_diff);
		}
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
    * @return Returns 1 of lane was changed, otherwise 0.
    */
   change_lane(dst, p)
   {
      // safety check
      if (dst == null)
         return 0;

      // check lane change probability
      if (SRandom.rand() > p)
         return 0;

      // get object ahead on the left lane
      var node = dst.ahead_of(this.d_pos + this.d_vis);

      // check if minimun distance of mobj behind on dst lane is too small
      if (node.next.data != null && node.next.data.d_pos + this.d_vis >= this.d_pos)
         return 0;

      this.relink(node, dst);

      return 1;
   }


   change_back()
   {
      return this.change_lane(this.lane.right, this.p_right);
   }


   pass()
   {
      return this.change_lane(this.lane.left, this.p_pass);
   }


   static kmh2ms(x)
   {
      return x / 3.6;
   }


   static ms2kmh(x)
   {
      return x * 3.6;
   }
}


class RandomCar extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.v_max = MovingObject.kmh2ms(100) + MovingObject.kmh2ms(50) * SRandom.rand();
      this.v_cur = this.v_max - MovingObject.kmh2ms(50) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(5);

      this.t_vis = 5.0;
      this.t_min = 2.0;
      this.a_acc = this.v_max / 20.0;
      this.a_dec = this.v_max / 10.0;
   }
}


class RandomTruck extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.v_max = MovingObject.kmh2ms(70) + MovingObject.kmh2ms(20) * SRandom.rand();
      this.v_cur = this.v_max - MovingObject.kmh2ms(20) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(5);

      this.t_vis = 5.0;
      this.t_min = 2.0;
      this.a_acc = this.v_max / 40.0;
      this.a_dec = this.v_max / 20.0;

      this.color = "blue";
   }
}


class RandomBike extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.v_max = MovingObject.kmh2ms(100) + MovingObject.kmh2ms(70) * SRandom.rand();
      this.v_cur = this.v_max - MovingObject.kmh2ms(70) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(5);

      this.t_vis = 5.0;
      this.t_min = 2.0;
      this.a_acc = this.v_max / 10.0;
      this.a_dec = this.v_max / 5.0;

      this.color = "green";
   }
}


class BlockingCar extends MovingObject
{
   constructor(node = null)
   {
      super(node);
      this.v_max = MovingObject.kmh2ms(100) + MovingObject.kmh2ms(30) * SRandom.rand();
      this.v_cur = this.v_max - MovingObject.kmh2ms(30) * SRandom.rand();
      this.v_diff = MovingObject.kmh2ms(5);

      this.t_vis = 5.0;
      this.t_min = 2.0;
      this.a_acc = this.v_max / 20.0;
      this.a_dec = this.v_max / 10.0;

      //this.p_right = 0.05;

      this.color = "red";
   }


   /*! Calculate probability to move back to the right for the blocking car.
    */
   get p_right()
   {
      // if there is no mobj behind or too far away don't change lane back
      if (this.node.next.data == null || this.node.next.data.d_pos < this.d_pos - this.d_vis)
         return 0;

      // otherwise change back with minimalistic probability
      return 0.05;
   }
}


class MObjFactory
{
   static make(type = "car")
   {
      switch (type)
      {
         case "truck":
            return new RandomTruck();
         case "bike":
            return new RandomBike();
         case "blocking":
            return new BlockingCar();
         default:
            console.log("*** unknown mobj type: " + type);
            // intenionally there's no break
         case "car":
            return new RandomCar();
      }
   }
}

