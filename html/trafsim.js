
//! maximum number of mobjs in the game (0 for unlimited)
const MAX_MOBJS = 100;
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
//! allow to pass on the right lanes
const PASS_RIGHT = 0;
//! distribution of mobj types
const MOBJ_TYPES = [
   {type: "car", p: 0.4},
   {type: "truck", p: 0.3},
   {type: "bike", p: 0.01},
   {type: "blocking", p: 0.29},
];


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
   //! seed of PRNG
   static seed = 1;


   /*! Generate a pseudo-random number.
    * @return Returns number x, 0.0 <= x < 1.0
    */
   static rand()
   {
      if (USE_MATH_RANDOM)
         return Math.random();

      var x = Math.sin(SRandom.seed++) * 10000;
      return x - Math.floor(x);
   }


   /*! Generate random event with probability p.
    * @param p Probability of event, p should be 0.0 <= p < 1.0.
    * @return Returns true with a probability of p, otherwise false.
    */
   static rand_ev(p)
   {
      return SRandom.rand() < p;
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
      // safety check
      if (this.data == null)
         console.log("unlinking head or tail node!");

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


   /*! Return DLinkNode which is directly ahead of position d_pos.
    * @param d_pos Position from which to look ahead.
    * @return Returns the DListNode of the object ahead.
    */
   ahead_of(d_pos)
   {
      var node;

      for (node = this.last.prev; node.data != null; node = node.prev)
         if (node.data.d_pos > d_pos)
            break;

      return node;
   }


   recalc(t_cur)
   {
      //! max number of iterations to prevent endless loop
      const MAX_LOOP = 10;

      this.integrity();
      // loop as long as no lane change appeared (because of changes in the linked list)
      for (var node = this.first.next, i = 0; node.data != null && i < MAX_LOOP; i++)
      {
         // loop over all elements in the list
         for (; node.data != null; node = node.next)
         {
            // restart outer loop in case of a lane change
            if (node.data.recalc(t_cur))
            {
               node = this.first.next;
               break;
            }
         }
      }

      if (i >= MAX_LOOP)
         console.log("probably endless loop in recalc()");
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

      this.mobj_cnt = 0;

      this.avg_speed = 0;
      this.avg_cnt = 0;

      this.running = 1;

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


   random_mobj_type()
   {
      var rnd = SRandom.rand();
      for (var i = 0; i < MOBJ_TYPES.length; i++)
      {
         if (rnd < MOBJ_TYPES[i].p)
            return MOBJ_TYPES[i].type;
         rnd -= MOBJ_TYPES[i].p;
      }
      console.log("*** no mobj randomly selected, probably definition error in MOBJ_TYPES");
      return "car";
   }


   gen_mobj()
   {
      return new DListNode(MObjFactory.make(this.random_mobj_type()));
   }


   /*! Calculate next time frame of simulation.
    */
   next_frame()
   {
      if (!this.running)
         return;

      if (this.running < 0 && (-this.running <= this.cur_frame))
      {
         this.running = 0;
         return;
      }

      // increase frame counter
      this.cur_frame++;

      for (var i = 0; i < this.lanes.length; i++)
      {
         // remove mobjs which are out of scope of the lane
         for (var node = this.lanes[i].first.next; node.data != null && node.data.d_pos > this.d_max; node = node.next, this.mobj_cnt--)
         {
            node.unlink();
            //console.log("removed " + node.data + ", type = " + node.data.constructor.name + ", time = " + (this.cur_frame - node.data.t_init) + ", avg_speed = " + MovingObject.ms2kmh(node.data.d_pos / (this.cur_frame - node.data.t_init)));
            this.avg_speed = (this.avg_speed * this.avg_cnt + MovingObject.ms2kmh(node.data.d_pos / (this.cur_frame - node.data.t_init))) / (this.avg_cnt + 1);
            this.avg_cnt++;
            console.log("average speed = " + this.avg_speed);
         }


         // fill in new mobjs on 1st lane if there are less than MAX_MOBJS mobjs and the previous one is far enough
         if ((!MAX_MOBJS || this.mobj_cnt < MAX_MOBJS) && (this.lanes[i].last.prev.data == null || this.lanes[i].last.prev.data.d_pos > MIN_ENTRY_POS))
         {
            // create and init new mobj and list node
            var node = this.gen_mobj();
            node.data.node = node;
            node.data.lane = this.lanes[i];
            node.data.t_init = this.cur_frame;
            node.data.save();
            this.mobj_cnt++;

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
            //this.ctx.fillStyle = this.ctx.strokeStyle = X11Colors[mobj.id*179%X11Colors.length].val;
            this.ctx.fillStyle = this.ctx.strokeStyle = mobj.color;
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


   key_down_handler(e)
   {
      switch (e.key)
      {
         case ' ':
            this.running = !this.running;
            break;

         case 's':
            if (!this.running)
               this.running = -(this.cur_frame + 1);
            break;

         case 'S':
            if (!this.running)
               this.running = -(this.cur_frame + 25);
            break;

      }
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
document.addEventListener('keydown', function(e){ts.key_down_handler(e);});
ts.timer = window.setInterval(function(){ts.draw(); ts.next_frame();}, 40);


