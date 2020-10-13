
//! maximum number of cars per lane
const MAX_CARS_PER_LANE = 10;
//! new mobjs do not enter befor MIN_ENTRY_POS meters
const MIN_ENTRY_POS = 500;
//! maximum frames to calculate
const MAX_FRAMES = 600;

const COL = ["#0000FF", "#8A2BE2", "#A52A2A", "#DEB887", "#5F9EA0", "#7FFF00", "#D2691E", "#FF7F50", "#6495ED", "#FFF8DC", "#DC143C", "#00FFFF"];


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
      this.id = this.id_cnt++;
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
			this.accelerate(this.v_max);
			return;
		}

      // get previous mobject
      var prev = this.node.prev.data;

		// if prev mobj is too far ahead, accelerate if possible
      if (this.d_pos < prev.d_pos - d_vis)
      {
			this.accelerate(this.v_max);
			return;
      }

		// detect crash and immediately start to decelerate
		if (this.d_pos >= prev.d_pos)
		{
			console.log("crash detected");
			this.crash = prev.crash = 1;
         this.d_pos = prev.d_pos;
			this.decelerate(0);
         return;
		}

		// if minimum distance is not maintained, decelerate
		if (this.d_pos > prev.d_pos - d_min)
		{
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
      this.v_max = MovingObject.kmh2ms(100) + MovingObject.kmh2ms(50) * Math.random();
      this.v_cur = this.v_max - MovingObject.kmh2ms(50) * Math.random();
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
   constructor()
   {
      //! pointer to first mobj
      this.first = null;
      //! pointer to last mobj
      this.last = this.first;
      //! number of mobjs on the lane
      this.length = 0;
   }


   append(mobj)
   {
      // create node list node
      var node = new DListNode(mobj);
      // backlink node to object
      mobj.node = node;
      // increase element counter
      this.length++;

      // handle special case of first element
      if (this.last == null)
      {
         this.first = this.last = node;
         return;
      }

      // otherwise insert behind
      this.last.insert(node);
      this.last = node;
   }


   recalc()
   {
      // loop over all elements in the list
      for (var node = this.first; node != null; node = node.next)
      {
         node.data.recalc();
      }
   }
}


class TrafSim
{
   constructor(canvas, rlen = 25000)
   {
      this.canvas = canvas;

      this.lane = new Lane();

      this.timer = null;

      this.t_frame = 1;
      this.ctx = this.canvas.getContext('2d');
      this.cur_frame = 0;

      this.sx = 1;
      this.sy = 1;

      this.d_max = rlen;
      this.d_min = 0;
   }


   /*! Calculate scaling of display.
    */
   scaling()
   {
      this.canvas.width = document.body.clientWidth;
      this.canvas.height = window.innerHeight;

      this.sx = this.canvas.width / (this.d_max - this.d_min);
      this.sy = this.canvas.height / 100;
   }


   /*! Calculate next time frame of simulation.
    */
   next_frame()
   {
      // increase frame counter
      this.cur_frame++;

      // check if there are enough cars on the lane
      if (this.lane.length < MAX_CARS_PER_LANE && (this.lane.last == null || this.lane.last.data.d_pos > MIN_ENTRY_POS))
      {
         this.lane.append(new RandomCar());
      }

      this.lane.recalc();

      if (this.cur_frame >= MAX_FRAMES)
         window.clearInterval(this.timer);
   }


   /*! Draw all current moving objects.
    */
   draw()
   {
      this.ctx.clearRect(0, 0, this.canvas.width, 100);

      this.ctx.save();
      this.ctx.scale(this.sx, this.sy);
      this.ctx.lineWidth = 0.5;

      var i, node, mobj;
      for (i = 0, node = this.lane.first; node != null; i++, node = node.next)
      {
         mobj = node.data;
         this.ctx.fillStyle = COL[i];
         this.ctx.beginPath();
         this.ctx.rect(mobj.d_pos - this.d_min, 1, 50, 1);
         this.ctx.fill();

         this.ctx.strokeStyle = COL[i];
         this.ctx.beginPath();
         this.ctx.moveTo(mobj.d_old - this.d_min, 100 - mobj.v_old * 1.5);
         this.ctx.lineTo(mobj.d_pos - this.d_min, 100 - mobj.v_cur * 1.5);
         this.ctx.stroke();
      }

      this.ctx.restore();
   }
}


var canvas = document.getElementById('raceplane');
canvas.width = document.body.clientWidth;
canvas.height = window.innerHeight;

var ts = new TrafSim(canvas);

ts.scaling();
ts.draw();

window.addEventListener('resize', function(e){ts.scaling(); ts.draw();});
ts.timer = window.setInterval(function(){ts.draw(); ts.next_frame();}, 40);


