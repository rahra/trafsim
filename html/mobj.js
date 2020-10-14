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

      //! backup data
      this.old = {v_cur: this.v_cur, d_pos: this.d_pos, prev: null, next: null};
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
      this.v_cur = Math.max(this.v_cur - this.a_dec, v_min);
   }


   /*! Save current state.
    */
   save()
   {
      this.old.v_cur = this.v_cur;
      this.old.d_pos = this.d_pos;
      this.old.prev = this.node.prev != null ? this.node.prev.data : null;
      this.old.next = this.node.next != null ? this.node.next.data : null;
   }


	recalc(t_cur)
	{
      // check if current frame already calculated
      if (this.t_cur >= t_cur)
         return;

      this.save();
      this.t_cur = t_cur;

      if (SRandom.rand() < MOBJ_FAIL)
      {
         console.log(this.id + " fails");
         this.crash = 1;
      }

		// crashed mobjs don't do anything accept stopping immediately
		if (this.crash)
		{
         if (this.v_cur > 0)
            this.decelerate(0);
			return;
      }

		// and move ahead
		this.d_pos += this.v_cur;

		// if there is no mobj ahead, accelerate if possible
		if (this.node.prev.data == null)
      {
         // change lane to the right if possible
         if (!this.change_lane(this.lane.right, this.d_vis))
            // otherwise speedup
			   this.accelerate(this.v_max);
			return;
		}

      // get previous mobject
      var prev = this.node.prev.data;

		// if prev mobj is too far ahead, accelerate if possible
      if (this.d_pos < prev.d_pos - this.d_vis)
      {
         // change lane to the right if possible
         if (!this.change_lane(this.lane.right, this.d_vis))
            // otherwise speedup
			   this.accelerate(this.v_max);
			return;
      }

		// detect crash and immediately start to decelerate
		if (this.d_pos >= prev.d_pos)
		{
			console.log("mobj " + this.id + " crashes");
			this.crash = prev.crash = 1;
         this.d_pos = prev.d_pos;
			this.decelerate(0);
         return;
		}

		// if minimum distance is not maintained, decelerate
		if (this.d_pos > prev.d_pos - this.d_min)
		{
         // if possible change lane
         if (!this.change_lane(this.lane.left, this.d_min))
            // otherwise decelerate
			   this.decelerate(prev.v_cur - this.v_diff);
		}
/*
// #ifdef MTAIN_CONSTSPEED
		else if (this.d_pos > prev.d_pos - d_min * 1.5)
		{
			this.decelerate(prev.v_cur);
		}
// #endif
*/
		// if prev mobj is within visibility
		else if (this.d_pos > prev.d_pos - this.d_vis)
		{
			// if approach speed difference is higher than valid, decelerate
			if (this.v_cur - prev.v_cur > this.v_diff)
				this.decelerate(prev.v_cur + this.v_diff);
	/*      else if (this.v_cur - prev.v_cur < this.v_diff)
				this.accelerate(prev.v_cur + this.v_diff);*/
		}
	}


   relink(node)
   {
      console.log(this + " changing lane");
      this.node.unlink();
      node.append(this.node);
   }


   change_lane(dst, d_min)
   {
      if (dst == null)
         return 0;

      // get object ahead on the left lane
      var lobj = dst.ahead_of(this.d_pos);

      // if there is no mobj ahead
      if (lobj == null)
      {
         this.relink(dst.first);
      }
      else
      {
         // check if minimum distance of next mobj on dst lane too small
         if (this.d_pos >= lobj.d_pos - d_min)
            return 0;
         // check if minimun distance of mobj behind on dst lane is too small
         if (lobj.node.next.data != null && lobj.node.next.data.d_pos + d_min >= this.d_pos)
            return 0;

         this.relink(lobj.node);
      }

      return 1;
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

