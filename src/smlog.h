/* Copyright 2011 Bernhard R. Fischer, 2048R/5C5FFD47 <bf@abenteuerland.at>
 *
 * This file is part of smrender.
 *
 * Smfilter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * Smfilter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with smrender. If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef SMLOG_H
#define SMLOG_H

#include <stdint.h>
#include <syslog.h>

#if __STDC_VERSION__ < 199901L
#if __GNUC__ >= 2
#define __func__ __FUNCTION__
#else
#define __func__ "<unknown>"
#endif
#endif

#define LOG_WARN LOG_WARNING
#define log_debug(fmt, x...) log_msg(LOG_DEBUG, "%s() " fmt, __func__, ## x)
#define log_warn(x...) log_msg(LOG_WARN, ## x)

/* smlog.c */
int log_msg(int, const char*, ...) __attribute__((format (printf, 2, 3)));
int log_errno(int , const char *);
void log_errno_exit(int , const char *);

#endif

