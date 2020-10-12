#ifndef MOBJ_OUT_H
#define MOBJ_OUT_H


typedef enum {FMT_CSV, FMT_CSS, FMT_XML_ATTR, FMT_JSON} fmt_t;


void start_frame(FILE *f, fmt_t fm, int t);
void end_frame(FILE *f, fmt_t fm);
void mobj_print(FILE *f, fmt_t fm, int t, const mobj_t *mo);


#endif

