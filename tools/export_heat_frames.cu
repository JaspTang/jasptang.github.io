#include "Grid.hpp"
#include "HeatSolver.hpp"

#include <cuda_runtime.h>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
void checkCuda(cudaError_t error, const char* operation) {
    if (error != cudaSuccess) throw std::runtime_error(std::string(operation) + ": " + cudaGetErrorString(error));
}
}

// Export actual center slices from HeatEngine's CUDA grid and production solver.
int main(int argc, char** argv) {
    try {
        if (argc != 2) throw std::runtime_error("Usage: export_heat_frames <output.bin>");
        constexpr std::uint32_t width = 96, height = 96, depth = 64;
        constexpr std::uint32_t frameCount = 37, stepsPerFrame = 4;
        constexpr std::uint32_t slice = depth / 2;

        Grid grid(width, height, depth);
        grid.initializeThermalLab(0.0f, 1.0f);
        Solver solver(grid, 1.0f, 0.10f, 1.0f, true);
        std::vector<float> hostSlice(static_cast<std::size_t>(width) * height);
        std::ofstream output(argv[1], std::ios::binary);
        if (!output) throw std::runtime_error("Unable to open output file");
        const std::uint32_t header[] = {width, height, depth, slice, frameCount, stepsPerFrame};
        output.write(reinterpret_cast<const char*>(header), sizeof(header));

        for (std::uint32_t frame = 0; frame < frameCount; ++frame) {
            if (frame != 0) for (std::uint32_t step = 0; step < stepsPerFrame; ++step) solver.step();
            const float* deviceSlice = grid.d_Temp + static_cast<std::size_t>(slice) * width * height;
            checkCuda(cudaMemcpy(hostSlice.data(), deviceSlice, hostSlice.size() * sizeof(float), cudaMemcpyDeviceToHost),
                      "copy simulation slice");
            output.write(reinterpret_cast<const char*>(hostSlice.data()), hostSlice.size() * sizeof(float));
        }
        if (!output) throw std::runtime_error("Failed while writing simulation frames");
        std::cout << "Exported " << frameCount << " CUDA frames at z=" << slice << " from a "
                  << width << "x" << height << "x" << depth << " grid.\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Heat frame export error: " << error.what() << '\n';
        return 1;
    }
}
