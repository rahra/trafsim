#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#include "smlog.h"
#include "trafsim.h"
#include "mobj_mem.h"
#include "mobj_out.h"


#define KMH2MS(x) ((x) / 3.6)


/*! Accelerate, but not more than v_max.
 */
void mobj_accelerate(mobj_t *mo, double v_max)
{
   // increase speed to the max if not already reached
   mo->v_cur = fmin(mo->v_cur + mo->a_acc, fmin(v_max, mo->v_max));
}


/*! Decelerate, but not less than v_min.
 */
void mobj_decelerate(mobj_t *mo, double v_min)
{
   mo->v_cur = fmax(mo->v_cur - mo->a_dec, v_min);
}


void mobj_recalc(mobj_t *mo)
{
   double d_vis, d_min;

   // safety check
   if (mo == NULL)
      log_msg(LOG_ERR, "null pointer caught");

   // crashed mobjs don't do anything
   if (mo->crash)
      return;

   // and move ahead
   mo->d_pos += mo->v_cur;
 
   // calc moving distance in visibility range and minimum distance
   d_vis = mo->v_cur * mo->t_vis;
   d_min = mo->v_cur * mo->t_min;

   // if there is no mobj ahead or it is too far away, accelerate if possible
   if (mo->prev == NULL || mo->d_pos < mo->prev->d_pos - d_vis)
   {
      mobj_accelerate(mo, mo->v_max);
      return;
   }

   // detect crash and immediately stop mobjs
   if (mo->d_pos >= mo->prev->d_pos)
   {
      log_msg(LOG_WARN, "crash detected");
      mo->crash = mo->prev->crash = 1;
      mo->v_cur = mo->prev->v_cur = 0;
   }

   // if minimum distance is not maintained, decelerate
   if (mo->d_pos > mo->prev->d_pos - d_min)
   {
      //mobj_decelerate(mo, mo->prev->v_cur - mo->v_diff);
      mobj_decelerate(mo, 0);
   }
   // if prev mobj is within visibility
   else if (mo->d_pos > mo->prev->d_pos - d_vis)
   {
      // if approach speed difference is higher than valid, decelerate
      if (mo->v_cur - mo->prev->v_cur > mo->v_diff)
         mobj_decelerate(mo, mo->prev->v_cur + mo->v_diff);
      else
         mobj_accelerate(mo, mo->prev->v_cur + mo->v_diff);
   }
}


double frand()
{
   return (double) random() / RAND_MAX;
}


void mobj_rnd_init(mobj_t *mo)
{
   mo->v_max = KMH2MS(100) + KMH2MS(50) * frand();
   mo->v_cur = mo->v_max - KMH2MS(50) * frand();
   mo->v_diff = KMH2MS(0);

   mo->t_vis = 5;
   mo->t_min = 2;
   mo->a_acc = 2.5;
   mo->a_dec = 5;
}


int main(int argc, char **argv)
{
   mobj_t *head, *mo;
   double pos;
   FILE *fout = stdout;
   int i, t_cur;

   head = mobj_new();
   mobj_rnd_init(head);
   for (i = 0; i < 10; i++)
   {
      mo = mobj_new();
      mobj_rnd_init(mo);
      mobj_insert_behind(head, mo);
   }

   pos = KMH2MS(150) * 20 * 12;
   for (mo = head; mo != NULL; mo = mo->next)
   {
      mo->d_pos = pos;
      pos -= KMH2MS(150) * 20 * frand();
   }

   for (t_cur = 0; t_cur < 900; t_cur++)
   {
      start_frame(fout, FMT_JSON, t_cur);
      for (mo = head; mo != NULL; mo = mo->next)
      {
         mobj_print(fout, FMT_JSON, t_cur, mo);
         mobj_recalc(mo);
      }
      end_frame(fout, FMT_JSON);
   }

   return 0;
}


static void __attribute__((constructor)) init_frand(void)
{
   unsigned int s = (uintptr_t) &s;

   srandom(s);
}

