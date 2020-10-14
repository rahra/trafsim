
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


function is_null(a)
{
   if (a == null)
      console.log("null pointer caught!");

   return a == null;
}


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
   constructor(data = null)
   {
      //! double linked list
      this.prev = null;    // previous means ahead
      this.next = null;    // next means behind
      //! data pointer
      this.data = data;
   }


   /*! Insert node directly before this.
    * @param node Node to insert.
    */
   insert(node)
   {
      // safety check
      if (is_null(node)) return;

      node.prev = this.prev;
      node.next = this;
      if (this.prev != null)
         this.prev.next = node;
      this.prev = node;
   }


   /*! Append node directly behind this.
    * @param node Node to append.
    */
   append(node)
   {
      if (is_null(node)) return;

      node.prev = this;
      node.next = this.next;
      if (this.next != null)
         this.next.prev = node;
      this.next = node;
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


class Lane
{
   static id_cnt = 0;


   constructor()
   {
      //! lane id
      this.id = Lane.id_cnt++;
      //! pointer to first mobj, head element
      this.first = new DListNode();
      //! pointer to last mobj, tail element
      this.last = new DListNode();
      //! neighbor lanes
      this.left = null;
      this.right = null;

      this.first.next = this.last;
      this.last.prev = this.first;
   }


   /*! Determine length of list.
    * @return Returns length of list, excluding the head and tail element.
    */
   get length()
   {
      var i, node;

      for (i = 0, node = this.first.next; node.data != null; node = node.next, i++);

      return i;
   }


   /*! Return mobj which is directly ahead of position d_pos.
    * @param d_pos Position from which to look ahead.
    * @return Returns the mobj object ahead, or null if there is no mobj ahead.
    */
   ahead_of(d_pos)
   {
      for (var node = this.last.prev; node.data != null; node = node.prev)
         if (node.data.d_pos > d_pos)
            return node.data;

      return null;
   }


   recalc(t_cur)
   {
      this.integrity();
      // loop over all elements in the list
      for (var node = this.first.next; node.data != null; node = node.next)
         node.data.recalc(t_cur);
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
      if (this.last.data != null)
         console.log("ERR5");
      if (this.first.data != null)
         console.log("ERR6");
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
         for (var node = this.lanes[i].first.next; node.data != null && node.data.d_pos > this.d_max; node = node.next)
            node.unlink();

         // check if there are enough cars on the lane, otherwise append new ones
         if (this.lanes[i].last.prev.data == null || this.lanes[i].last.prev.data.d_pos > MIN_ENTRY_POS)
         {
            // create and init new mobj and list node
            var node = new DListNode(new RandomCar());
            node.data.node = node;
            node.data.lane = this.lanes[i];

            // and append it to the lane
            this.lanes[i].last.insert(node);
         }

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
         for (i = 0, node = this.lanes[j].first.next; node.data != null; i++, node = node.next)
         {
            mobj = node.data;

            // draw mobj
            this.ctx.fillStyle = this.ctx.strokeStyle = X11Colors[mobj.id*179%X11Colors.length].val;
            this.ctx.beginPath();
            this.ctx.rect((mobj.d_pos - this.d_min) * this.sx, 20 + (this.lanes.length - j - 1) * 5, p, p);
            this.ctx.fill();

            // draw visibility range of mobj
            this.ctx.beginPath();
            this.ctx.moveTo((mobj.d_pos - this.d_min) * this.sx + p, 20 + (this.lanes.length - j - 1) * 5 + p * 0.5);
            this.ctx.lineTo((mobj.d_pos - this.d_min + mobj.d_vis) * this.sx + p, 20 + (this.lanes.length - j - 1) * 5 + p * 0.5);
            this.ctx.stroke();

            // draw speed curve
            this.ctx.beginPath();
            this.ctx.moveTo((mobj.old.d_pos - this.d_min) * this.sx, 300 - mobj.old.v_cur * 3);
            this.ctx.lineTo((mobj.d_pos - this.d_min) * this.sx, 300 - mobj.v_cur * 3);
            this.ctx.stroke();

            // draw crash box
            if (mobj.crash)
            {
               this.ctx.strokeStyle = "red";
               this.ctx.beginPath();
               this.ctx.rect((mobj.d_pos - this.d_min) * this.sx - 1, 20 + (this.lanes.length - j - 1) * 5 - 1, p+2, p+2);
               this.ctx.stroke();
            }
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


