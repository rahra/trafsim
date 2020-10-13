
//! maximum number of cars per lane
const MAX_CARS_PER_LANE = 30;
//! new mobjs do not enter befor MIN_ENTRY_POS meters
const MIN_ENTRY_POS = 500;
//! maximum frames to calculate (0 for unlimited)
const MAX_FRAMES = 0;
//! use Math.random() as PRNG
const USE_MATH_RANDOM = 0;
//! mobj failure probability
const MOBJ_FAIL = 0.0;
//! number of lanes
const NUM_LANES = 2;


/*! This class implements a simple (non-cryptographic) PRNG. It used to have
 * the ability to always start at the same seed which may be interesting to be
 * able to compare simulation data.
 */
class SRandom
{
   static seed = 1;

   static rand()
   {
      if (USE_MATH_RANDOM)
         return Math.random();

      var x = Math.sin(SRandom.seed++) * 10000;
      return x - Math.floor(x);
   }
}


class DListNode
{
   constructor(data)
   {
      //! double linked list
      this.prev = null;
      this.next = null;
      //! data pointer
      this.data = data;
   }


   /*! Insert node directly behind this.
    */
   insert(node)
   {
      // safety check
      if (node == null)
         return;
      console.log("DListNode.insert()");
      node.next = this.next;
      node.prev = this;
      this.next = node;
      if (node.next != null)
         node.next.prev = node;
   }


   /*! Unlink (remove) this node from list.
    */
   unlink()
   {
      console.log("DListNode.unlink()");
      if (this.prev != null)
         this.prev.next = this.next;
      if (this.next != null)
         this.next.prev = this.prev;
   }
}


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
      //! speed maintained in previous simulation frame
      this.v_old = 0.0;
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
      //! position of previous simulation frame
      this.d_old = 0.0;
      //! acceleration
      this.a_acc = 0.0;
      //! deceleration
      this.a_dec = 0.0;
      //! 1 if crash
      this.crash = 0;
      //! pointer to lane
      this.lane = null;
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
      this.v_old = this.v_cur;
      this.d_old = this.d_pos;
   }


	recalc()
	{
      this.save();

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

		// calc moving distance in visibility range and minimum distance
		var d_vis = this.v_cur * this.t_vis;
		var d_min = this.v_cur * this.t_min;

		// if there is no mobj ahead, accelerate if possible
		if (this.node.prev == null)
      {
         // change lane to the right if possible
         if (!this.change_lane(this.lane.right, d_vis))
            // otherwise speedup
			   this.accelerate(this.v_max);
			return;
		}

      // get previous mobject
      var prev = this.node.prev.data;

		// if prev mobj is too far ahead, accelerate if possible
      if (this.d_pos < prev.d_pos - d_vis)
      {
         // change lane to the right if possible
         if (!this.change_lane(this.lane.right, d_vis))
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
		if (this.d_pos > prev.d_pos - d_min)
		{
         // if possible change lane
         if (!this.change_lane(this.lane.left, d_min))
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
		else if (this.d_pos > prev.d_pos - d_vis)
		{
			// if approach speed difference is higher than valid, decelerate
			if (this.v_cur - prev.v_cur > this.v_diff)
				this.decelerate(prev.v_cur + this.v_diff);
	/*      else if (this.v_cur - prev.v_cur < this.v_diff)
				this.accelerate(prev.v_cur + this.v_diff);*/
		}
	}


   unlink()
   {
      // check if this is the last mobj on the current lane and remove it in case
      if (this.node.next == null)
         this.lane.unlink_last();
      else if (this.node.prev == null)
         this.lane.unlink_first();
      else
         this.lane.unlink(this);
   }


   change_lane(dst, d_min)
   {
      if (dst == null)
         return 0;

      // get object ahead on the left lane
      var lobj = dst.ahead_of(this.d_pos);

      // if there is no one
      if (lobj == null)
      {
         // check if this is the last mobj on the current lane and remove it in case
         this.unlink();

         // append mobj to the head of the left lane
         dst.append_first(this);
      }
      else
      {
         // check if minimum distance of next mobj on dst lane too small
         if (this.d_pos >= lobj.d_pos - d_min)
            return 0;
         // check if minimun distance of mobj behind on dst lane is too small
         if (lobj.node.next != null && lobj.node.next.data.d_pos + d_min >= this.d_pos)
            return 0;

         // check if this is the last mobj on the current lane and remove it in case
         this.unlink();

         // insert this behind the neighbor on the left
         // check if neigbor is last in lane
         if (lobj.node.next == null)
            dst.append_last(this);
         else
            dst.insert(lobj, this.node);
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

      this.save();
   }
}


class Lane
{
   static id_cnt = 0;


   constructor()
   {
      //! lane id
      this.id = Lane.id_cnt++;
      //! pointer to first mobj
      this.first = null;
      //! pointer to last mobj
      this.last = this.first;
      //! number of mobjs on the lane
      this.length = 0;
      //! neighbor lanes
      this.left = null;
      this.right = null;
   }


   /*! Append a new mobj to the end of the list.
    */
   append_last(mobj)
   {
      // create node list node
      var node = new DListNode(mobj);
      // backlink node to object
      mobj.node = node;
      mobj.lane = this;
      // increase element counter
      this.length++;

      console.log("lane " + this.id + " appending last mobj id = " + mobj.id + ", length = " + this.length);

      // handle special case of first element
      if (this.last == null)
      {
         this.first = this.last = node;
         return;
      }

      // otherwise insert behind
      node.prev = this.last;
      this.last.next = node;
      this.last = node;
   }


   /* Unlink (remove) the first mobj from the list.
    */
   unlink_first()
   {
      // safety check
      if (this.first == null)
         return;

      this.length--;

      console.log("lane " + this.id + " removing first mobj id = " + this.first.data.id + ", length = " + this.length);

      // check if it is the last on the lane (no one behind)
      if (this.first.next == null)
      {
         this.first = this.last = null;
      }
      else
      {
         this.first = this.first.next;
         this.first.prev = null;
      }
   }


   /* Unlink (remove) the last mobj from the list.
    */
   unlink_last()
   {
      // safety check
      if (this.last == null)
         return;

      this.length--;

      console.log("lane " + this.id + " removing last mobj id = " + this.first.data.id + ", length = " + this.length);

      // check if it is the last one on the lane (no one ahead)
      if (this.last.prev == null)
      {
         this.last = this.first = null;
      }
      else
      {
         this.last = this.last.prev;
         this.last.next = null;
      }
   }


   append_first(mobj)
   {
      // create node list node
      var node = new DListNode(mobj);
      // backlink node to object
      mobj.node = node;
      mobj.lane = this;
      // increase element counter
      this.length++;

      console.log("lane " + this.id + " appending ahead mobj id = " + mobj.id + ", length = " + this.length);

      if (this.first == null)
      {
         this.first = this.last = node;
         return;
      }

      node.next = this.first;
      this.first.prev = node;
      this.first = node;
   }


   unlink(mobj)
   {
      mobj.lane.length--;
      mobj.node.unlink();
      console.log("lane " + this.id + " removing intermediate mobj id = " + mobj.id + ", length = " + mobj.lane.length);
   }


   insert(lobj, node)
   {
      //safety check
      if (lobj.lane != this) console.log("ill lane!");
      node.data.lane = this;
      lobj.node.insert(node);
      lobj.lane.length++;
      console.log("lane " + this.id + " inserting intermediate mobj id = " + node.data.id + ", length = " + this.length);
   }


   /*! Return mobj which is directly ahead of position d_pos.
    * @param d_pos Position from which to look ahead.
    * @return Returns the mobj object ahead, or null if there is no mobj ahead.
    */
   ahead_of(d_pos)
   {
      for (var node = this.last; node != null; node = node.prev)
         if (node.data.d_pos > d_pos)
            return node.data;

      return null;
   }


   recalc()
   {
      this.integrity();
      // loop over all elements in the list
      for (var node = this.first; node != null; node = node.next)
      {
         node.data.recalc();
      }
   }


   integrity()
   {
      if (this.first == null && this.last != null)
         console.log("ERR1");
      if (this.first != null && this.last == null)
         console.log("ERR2");
      if (this.first != null && this.first.prev != null)
         console.log("ERR3");
      if (this.last != null && this.last.next != null)
         console.log("ERR4");
      var i, node;
      for (i = 0, node = this.first; node != null; node = node.next, i++);
      if (this.length != i)
         console.log(i + " != " + this.length);
   }
}


class TrafSim
{
   constructor(canvas, rlen = 25000)
   {
      this.canvas = canvas;

      this.lanes = [];
      this.timer = null;

      this.t_frame = 1;
      this.ctx = this.canvas.getContext('2d');
      this.cur_frame = 0;

      this.sx = 1;
      this.sy = 1;

      this.d_max = rlen;
      this.d_min = 0;

      this.init_lanes();
   }


   init_lanes()
   {
      for (var i = 0; i < NUM_LANES; i++)
      {
         // create new lane
         this.lanes.push(new Lane());

         // point to neigbor lanes
         if (i)
         {
            this.lanes[i - 1].left = this.lanes[i];
            this.lanes[i].right = this.lanes[i - 1];
         }
      }
   }


   /*! Calculate scaling of display.
    */
   scaling()
   {
      this.canvas.width = document.body.clientWidth;
      this.canvas.height = window.innerHeight;

      this.sx = this.canvas.width / (this.d_max - this.d_min);
      //this.sy = this.canvas.height / 100;
      this.sy = this.sx;
   }


   /*! Calculate next time frame of simulation.
    */
   next_frame()
   {
      // increase frame counter
      this.cur_frame++;

      for (var i = 0; i < this.lanes.length; i++)
      {
         // remove mobjs which are out of scope of the lane
         while (this.lanes[i].first != null && this.lanes[i].first.data.d_pos > this.d_max)
            this.lanes[i].unlink_first();

         // check if there are enough cars on the lane, otherwise append new ones
         if (this.lanes[i].length < MAX_CARS_PER_LANE && (this.lanes[i].last == null || this.lanes[i].last.data.d_pos > MIN_ENTRY_POS))
            this.lanes[i].append_last(new RandomCar());

         this.lanes[i].recalc();
      }

      if (MAX_FRAMES && this.cur_frame >= MAX_FRAMES)
         window.clearInterval(this.timer);
   }


   /*! Draw all current moving objects.
    */
   draw()
   {
      this.ctx.clearRect(0, 0, this.canvas.width, 100);

      //this.ctx.save();
      this.ctx.lineWidth = 1;

      var p = 3;

      for (var j = 0; j < this.lanes.length; j++)
      {
         var i, node, mobj;
         for (i = 0, node = this.lanes[j].first; node != null; i++, node = node.next)
         {
            mobj = node.data;
            this.ctx.fillStyle = X11Colors[mobj.id*179%X11Colors.length].val;
            this.ctx.beginPath();
            this.ctx.rect((mobj.d_pos - this.d_min) * this.sx, 20 + (this.lanes.length - j - 1) * 5, p, p);
            this.ctx.fill();

            if (mobj.crash)
            {
               this.ctx.strokeStyle = "red";
               this.ctx.beginPath();
               this.ctx.rect((mobj.d_pos - this.d_min) * this.sx - 1, 20 + (this.lanes.length - j - 1) * 5 - 1, p+2, p+2);
               this.ctx.stroke();
            }

            this.ctx.strokeStyle = X11Colors[mobj.id*179%X11Colors.length].val;
            this.ctx.beginPath();
            this.ctx.moveTo((mobj.d_old - this.d_min) * this.sx, 300 - mobj.v_old * 3);
            this.ctx.lineTo((mobj.d_pos - this.d_min) * this.sx, 300 - mobj.v_cur * 3);
            this.ctx.stroke();
         }
      }

      //this.ctx.restore();
   }
}


var canvas = document.getElementById('raceplane');
canvas.width = document.body.clientWidth;
canvas.height = window.innerHeight;

console.log("===== NEW RUN =====");

var ts = new TrafSim(canvas);

ts.scaling();
ts.draw();

window.addEventListener('resize', function(e){ts.scaling(); ts.draw();});
ts.timer = window.setInterval(function(){ts.draw(); ts.next_frame();}, 40);


