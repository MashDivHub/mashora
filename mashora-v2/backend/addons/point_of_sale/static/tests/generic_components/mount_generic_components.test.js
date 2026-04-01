import { expect, test } from "@mashora/hoot";
import { mountWithCleanup } from "@web/../tests/web_test_helpers";
import { Component, useState, xml } from "@mashora/owl";
import { MashoraLogo } from "@point_of_sale/app/components/mashora_logo/mashora_logo";
import { CenteredIcon } from "@point_of_sale/app/components/centered_icon/centered_icon";
import { Input } from "@point_of_sale/app/components/inputs/input/input";
import { NumericInput } from "@point_of_sale/app/components/inputs/numeric_input/numeric_input";
import { registry } from "@web/core/registry";
import { waitFor } from "@mashora/hoot-dom";

test("test that generic components can be mounted; the goal is to ensure that they don't have any unmet dependencies", async () => {
    class TestComponent extends Component {
        static props = [];
        static components = {
            MashoraLogo,
            CenteredIcon,
            Input,
            NumericInput,
        };
        static template = xml`
            <div class="test-container">
                <MashoraLogo />
                <CenteredIcon icon="'fa-smile'"/>
                <Input tModel="[state, 'number']"/>
                <NumericInput tModel="[state, 'number']" />
            </div>
        `;
        setup() {
            this.state = useState({ number: 1 });
        }
    }

    registry.category("services").content = {};

    await mountWithCleanup(TestComponent, {
        noMainContainer: true,
    });
    await waitFor("div.test-container");
    expect(true).toBe(true);
});
