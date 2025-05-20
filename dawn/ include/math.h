// mock_math.h
#ifndef MOCK_MATH_H
#define MOCK_MATH_H

// Constants
#define M_PI 3.14159265358979323846
#define HUGE_VAL 1e500

// Mocked functions
static inline double sin(double x) { return 0.0; }
static inline double cos(double x) { return 1.0; }
static inline double tan(double x) { return 0.0; }
static inline double sqrt(double x) { return 1.0; }
static inline double pow(double base, double exp) { return 1.0; }
static inline double fabs(double x) { return x < 0 ? -x : x; }
static inline double log(double x) { return 0.0; }
static inline double exp(double x) { return 1.0; }

#endif // MOCK_MATH_H
