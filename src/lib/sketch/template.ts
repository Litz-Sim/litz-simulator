/** Firmware shown in a new sketch. It is the Litz equivalent of Wokwi's blink. */
export const DEFAULT_CODE = `#include <stdio.h>

#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define LED_PIN GPIO_NUM_8

void app_main(void) {
    gpio_reset_pin(LED_PIN);
    gpio_set_direction(LED_PIN, GPIO_MODE_OUTPUT);

    while (1) {
        gpio_set_level(LED_PIN, 1);
        printf("led on\\n");
        vTaskDelay(pdMS_TO_TICKS(500));

        gpio_set_level(LED_PIN, 0);
        printf("led off\\n");
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
`;
