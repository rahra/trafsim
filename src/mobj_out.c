#include <stdio.h>
#include <stdlib.h>
#include <math.h>

#include "trafsim.h"
#include "mobj_out.h"


void start_frame(FILE *f, fmt_t fm, int t)
{
   char *fmt;

   switch (fm)
   {
      case FMT_XML_ATTR:
         fmt = "";
         break;

      case FMT_CSV:
         fmt = "";
         break;

      case FMT_JSON:
         fmt = "[\n";
         break;

      case FMT_CSS:
      default:
         fmt = "";

   }

   fprintf(f, fmt, t);
}


void end_frame(FILE *f, fmt_t fm)
{
   char *fmt;

   switch (fm)
   {
      case FMT_XML_ATTR:
         fmt = "";
         break;

      case FMT_CSV:
         fmt = "";
         break;

      case FMT_JSON:
         fmt = "],\n";
         break;

      case FMT_CSS:
      default:
         fmt = "";

   }

   fprintf(f, fmt);
}


void mobj_print(FILE *f, fmt_t fm, int t, const mobj_t *mo)
{
   char *fmt;

   switch (fm)
   {
      case FMT_XML_ATTR:
         fmt = "t=\"%d\" id=\"%d\" v_cur=\"%.1f\" v_max=\"%.1f\" t_vis=\"%.1f\" t_min=\"%.1f\" d_pos=\"%.1f\" a_acc=\"%.1f\" a_dec=\"%.1f\" crash=\"%d\"\n";
         break;

      case FMT_CSV:
         fmt = "%d, %d, %.1f, %.1f, %.1f, %.1f, %.1f, %.1f, %.1f, %d\n";
         break;

      case FMT_JSON:
         fmt = "{t:%d,id:%d,v_cur:%.1f,v_max:%.1f,t_vis:%.1f,t_min:%.1f,d_pos:%.1f,a_acc:%.1f,a_dec:%.1f,crash:%d,},\n";
         break;

      case FMT_CSS:
      default:
         fmt = "t:%d;id:%d;v_cur:%.1f;v_max:%.1f;t_vis:%.1f;t_min:%.1f;d_pos:%.1f;a_acc:%.1f;a_dec:%.1f;crash:%d;\n";

   }

   fprintf(f, fmt, t, mo->id, mo->v_cur, mo->v_max, mo->t_vis, mo->t_min, mo->d_pos, mo->a_acc, mo->a_dec, mo->crash);
}

