
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


   recalc(t_cur)
   {
      this.integrity();
      // loop over all elements in the list
      for (var node = this.first; node != null; node = node.next)
      {
         node.data.recalc(t_cur);
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

         this.lanes[i].recalc(this.cur_frame);
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
            this.ctx.moveTo((mobj.old.d_pos - this.d_min) * this.sx, 300 - mobj.old.v_cur * 3);
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


