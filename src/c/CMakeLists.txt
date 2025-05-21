cmake_minimum_required(VERSION 3.15)
project(WebGPUWrapperC LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED True)

# Determine ARCH_NAME (e.g., x86_64, aarch64)
if(CMAKE_SYSTEM_PROCESSOR MATCHES "^(x86_64|amd64|AMD64)$")
    set(ARCH_NAME "x86_64")
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "^(aarch64|arm64|ARM64)$")
    set(ARCH_NAME "aarch64")
elseif(CMAKE_HOST_APPLE AND CMAKE_SYSTEM_PROCESSOR MATCHES "^arm") # Apple Silicon
    set(ARCH_NAME "aarch64")
else()
    message(WARNING "Unsupported processor architecture: ${CMAKE_SYSTEM_PROCESSOR}. Will attempt to use as '${CMAKE_SYSTEM_PROCESSOR}'. This might not match the Dawn library directory structure.")
    set(ARCH_NAME ${CMAKE_SYSTEM_PROCESSOR})
endif()

# Determine OS_NAME (e.g., linux, macos, windows)
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(OS_NAME "linux")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    set(OS_NAME "macos")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows")
    set(OS_NAME "windows")
else()
    message(FATAL_ERROR "Unsupported operating system: ${CMAKE_SYSTEM_NAME}")
endif()

set(TARGET_ARCH_OS_SUBDIR "${ARCH_NAME}-${OS_NAME}")
message(STATUS "Targeting architecture-OS: ${TARGET_ARCH_OS_SUBDIR}")

# --- Library Definition ---
add_library(webgpu_wrapper SHARED lib.c)

# --- Compile Definitions ---
target_compile_definitions(webgpu_wrapper PRIVATE WGPU_IMPLEMENTATION)

# Base directory for all of Dawn artifacts
set(DAWN_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../dawn")
# Specific directory for precompiled Dawn platform libraries and headers
set(DAWN_PLATFORM_LIBS_DIR "${DAWN_ROOT_DIR}/libs/${TARGET_ARCH_OS_SUBDIR}")

message(STATUS "Expecting Dawn platform libraries at: ${DAWN_PLATFORM_LIBS_DIR}")

# Validate Dawn paths
if(NOT EXISTS "${DAWN_PLATFORM_LIBS_DIR}")
    message(FATAL_ERROR "Dawn platform libraries directory not found: ${DAWN_PLATFORM_LIBS_DIR}\n"
                        "Please ensure Dawn libraries (including headers and static lib) are prebuilt and available at this location for target '${TARGET_ARCH_OS_SUBDIR}'.")
endif()
if(NOT EXISTS "${DAWN_PLATFORM_LIBS_DIR}/include")
    message(FATAL_ERROR "Dawn platform include directory not found: ${DAWN_PLATFORM_LIBS_DIR}/include")
endif()

target_include_directories(webgpu_wrapper PRIVATE
    "${DAWN_PLATFORM_LIBS_DIR}/include/dawn"
)
target_link_directories(webgpu_wrapper PRIVATE "${DAWN_PLATFORM_LIBS_DIR}")
target_link_libraries(webgpu_wrapper PRIVATE webgpu_dawn)

# --- Platform-Specific System Libraries & Settings ---
if(APPLE) # macOS (CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    target_link_libraries(webgpu_wrapper PRIVATE
        "-framework Foundation"
        "-framework CoreFoundation"
        "-framework IOKit"
        "-framework IOSurface"
        "-framework Metal"
        "-framework QuartzCore"
    )
    # Link C++ standard library, as Dawn is C++
    set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -lc++")

elseif(UNIX AND NOT APPLE) # Linux
    target_link_libraries(webgpu_wrapper PRIVATE pthread dl m stdc++)

elseif(WIN32) # Windows
    target_link_libraries(webgpu_wrapper PRIVATE
        user32
        kernel32
        gdi32
        ole32
        uuid
        d3d11
        d3d12
        dxgi
        dxguid
    )
    if(MSVC)
        # Ensure symbols are exported from the DLL if WGPU_EXPORT relies on __declspec(dllexport)
        set_target_properties(webgpu_wrapper PROPERTIES WINDOWS_EXPORT_ALL_SYMBOLS ON)
        # For MSVC, control CRT linking if necessary (e.g., if webgpu_dawn.lib uses static CRT)
        # set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>") # Example for static CRT
    endif()
endif()

# --- Output Directory ---
set(OUTPUT_DIR_BASE "${CMAKE_CURRENT_SOURCE_DIR}/../lib")
set(FINAL_OUTPUT_DIR "${OUTPUT_DIR_BASE}/${TARGET_ARCH_OS_SUBDIR}")

set_target_properties(webgpu_wrapper PROPERTIES
    ARCHIVE_OUTPUT_DIRECTORY "${FINAL_OUTPUT_DIR}"
    LIBRARY_OUTPUT_DIRECTORY "${FINAL_OUTPUT_DIR}"
    RUNTIME_OUTPUT_DIRECTORY "${FINAL_OUTPUT_DIR}"
)

# --- Installation ---
install(TARGETS webgpu_wrapper
    LIBRARY DESTINATION "lib/${TARGET_ARCH_OS_SUBDIR}"
    RUNTIME DESTINATION "lib/${TARGET_ARCH_OS_SUBDIR}"
    ARCHIVE DESTINATION "lib/${TARGET_ARCH_OS_SUBDIR}"
)

message(STATUS "Configured 'webgpu_wrapper' for target: ${TARGET_ARCH_OS_SUBDIR}")
message(STATUS "Output artifacts will be placed in: ${FINAL_OUTPUT_DIR}")
message(STATUS "Installation path prefix for 'webgpu_wrapper': lib/${TARGET_ARCH_OS_SUBDIR}")
